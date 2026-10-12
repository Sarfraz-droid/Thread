import { afterEach, describe, expect, mock, test } from "bun:test";
import { createClient } from "../../apps/web/node_modules/@supabase/supabase-js";
import type { Database } from "@mailer/core/database";
import {
  emptyProfile,
  findPlaceholders,
  readDraftChatReply,
  type Draft,
  type DraftReview,
} from "../../packages/core/src/index";
mock.module("server-only", () => ({}));
const { reviewDraft } = await import("../../apps/web/lib/server/review");
const originalFetch = globalThis.fetch;
const originalKey = process.env.AKASH_API_KEY;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.AKASH_API_KEY;
  else process.env.AKASH_API_KEY = originalKey;
});
const owner = "11111111-1111-4111-8111-111111111111";
const draftId = "22222222-2222-4222-8222-222222222222";
function harness(reviews: DraftReview[]) {
  let draft: Draft = {
    id: draftId,
    user_id: owner,
    opportunity_id: draftId,
    recipient_email: "sam@example.test",
    cc_emails: [],
    bcc_emails: [],
    subject: "Referral request",
    body: "Hi Sam,\n\nCould you refer me?\n\nThanks",
    attachment_ids: [],
    status: "draft",
    version: 1,
    gmail_message_id: null,
    sent_at: null,
    created_at: "now",
    updated_at: "now",
  };
  const messages: Record<string, unknown>[] = [];
  let aiCalls = 0;
  const fetcher = mock(
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input
            : input.url,
      );
      if (url.host === "api.akashml.com") {
        const review = reviews[Math.min(aiCalls++, reviews.length - 1)];
        return Response.json({
          id: "test",
          model: "test",
          created: 0,
          choices: [
            {
              index: 0,
              finish_reason: "stop",
              message: { role: "assistant", content: JSON.stringify(review) },
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
        });
      }
      const table = url.pathname.split("/").at(-1);
      const method = init?.method ?? "GET";
      const body =
        typeof init?.body === "string" ? JSON.parse(init.body) : null;
      const returning = new Headers(init?.headers)
        .get("accept")
        ?.includes("vnd.pgrst.object");
      const rows = (data: unknown[]) =>
        Response.json(returning ? data[0] : data);
      if (table === "drafts") {
        if (method === "PATCH") {
          if (url.searchParams.get("version") !== `eq.${draft.version}`)
            return Response.json([]);
          draft = { ...draft, ...body };
        }
        return rows([draft]);
      }
      if (table === "opportunities")
        return rows([
          { id: draftId, company: "Example", role: "Engineer", research: "" },
        ]);
      if (table === "profiles")
        return rows([
          { data: emptyProfile, settings: { model: "openai/gpt-oss-120b" } },
        ]);
      if (table === "relevant_memories" || table === "memories")
        return Response.json([]);
      if (table === "conversations") return new Response(null, { status: 201 });
      if (table === "messages") {
        messages.push(body);
        return new Response(null, { status: 201 });
      }
      throw new Error(`Unexpected test request: ${table}`);
    },
  );
  globalThis.fetch = fetcher as unknown as typeof fetch;
  process.env.AKASH_API_KEY = "test-only-key";
  const db = createClient<Database>(
    "https://workspace.example.test",
    "test-key",
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: fetcher as unknown as typeof fetch },
    },
  );
  return { db, messages, aiCalls: () => aiCalls, draft: () => draft };
}
describe("auto review", () => {
  test("applies a revision, re-checks it, and records the review in the thread", async () => {
    const app = harness([
      {
        approved: true,
        summary: "Tightened the ask.",
        issues: [{ severity: "minor", note: "The ask was vague." }],
        revision: {
          subject: "Referral for the Engineer role",
          body: "Hi Sam,\n\nWould you refer me for the Engineer role at Example?\n\nThanks",
        },
      },
      { approved: true, summary: "Looks good.", issues: [], revision: null },
    ]);
    const result = await reviewDraft(app.db, owner, draftId, 1);
    expect(app.aiCalls()).toBe(2);
    expect(result.approved).toBe(true);
    expect(result.revised).toBe(true);
    expect(result.draft.version).toBe(2);
    expect(result.draft.subject).toBe("Referral for the Engineer role");
    expect(result.draft.recipient_email).toBe("sam@example.test");
    const reply = readDraftChatReply(String(app.messages[0].content));
    expect(reply?.draft_updated).toBe(true);
    expect(reply?.message).toContain("ready to send");
  });
  test("blocks sending when the reviewer needs the owner", async () => {
    const app = harness([
      {
        approved: false,
        summary: "The role is unclear.",
        issues: [{ severity: "blocking", note: "Which role is this for?" }],
        revision: null,
      },
    ]);
    const result = await reviewDraft(app.db, owner, draftId, 1);
    expect(app.aiCalls()).toBe(1);
    expect(result.approved).toBe(false);
    expect(result.revised).toBe(false);
  });
  test("a leftover placeholder blocks approval even if the model approves", async () => {
    const app = harness([
      {
        approved: true,
        summary: "Fine.",
        issues: [],
        revision: {
          subject: "Referral request",
          body: "Hi [Recipient Name],\n\nCould you refer me?",
        },
      },
      { approved: true, summary: "Fine.", issues: [], revision: null },
    ]);
    const result = await reviewDraft(app.db, owner, draftId, 1);
    expect(result.approved).toBe(false);
    expect(result.issues.at(-1)?.note).toContain("[Recipient Name]");
  });
  test("a stale version is rejected before any AI call", async () => {
    const app = harness([]);
    await expect(reviewDraft(app.db, owner, draftId, 3)).rejects.toThrow(
      "changed",
    );
    expect(app.aiCalls()).toBe(0);
  });
});
test("placeholder detection ignores ordinary prose", () => {
  expect(findPlaceholders("Hi {{name}}", "Role: <Job Title>", "TODO")).toEqual([
    "{{name}}",
    "<Job Title>",
    "TODO",
  ]);
  expect(
    findPlaceholders("Hi Sam, I built APIs in TypeScript (and Go)."),
  ).toEqual([]);
});
