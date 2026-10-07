import { afterEach, describe, expect, mock, test } from "bun:test";
import { createClient } from "../../apps/web/node_modules/@supabase/supabase-js";
import type { Database } from "@mailer/core/database";
import {
  emptyProfile,
  applyProfileUpdates,
  groundedProfileUpdates,
  readDraftChatReply,
  type Draft,
  type Memory,
  type ProfileUpdate,
} from "../../packages/core/src/index";
mock.module("server-only", () => ({}));
const { draftChat, draftMessages } =
  await import("../../apps/web/lib/server/draft-chat");
const originalFetch = globalThis.fetch;
const originalKey = process.env.AKASH_API_KEY;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.AKASH_API_KEY;
  else process.env.AKASH_API_KEY = originalKey;
});
const owner = "11111111-1111-4111-8111-111111111111";
const draftId = "22222222-2222-4222-8222-222222222222";
const source = "Make it shorter. I led a team of five engineers.";
function harness(
  options: {
    stale?: boolean;
    memoryFailure?: boolean;
    memory?: Partial<Memory>;
    preference?: boolean;
  } = {},
) {
  let draft: Draft = {
    id: draftId,
    user_id: owner,
    opportunity_id: draftId,
    recipient_email: "sam@example.test, alex@example.test",
    cc_emails: ["team@example.test"],
    bcc_emails: ["archive@example.test"],
    subject: "Original subject",
    body: "Original message",
    attachment_ids: [draftId],
    status: "draft",
    version: 1,
    gmail_message_id: null,
    sent_at: null,
    created_at: "now",
    updated_at: "now",
  };
  const messages: Record<string, unknown>[] = [];
  const memories: Record<string, unknown>[] = [];
  let aiCalls = 0;
  let writes = 0;
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
        aiCalls++;
        if (options.stale)
          draft = { ...draft, body: "Edited in another tab", version: 2 };
        return Response.json({
          id: "test",
          model: "test",
          created: 0,
          choices: [
            {
              index: 0,
              finish_reason: "stop",
              message: {
                role: "assistant",
                content: JSON.stringify({
                  message:
                    "I shortened the email and highlighted your team leadership.",
                  draft: {
                    subject: "Referral request",
                    body: "Hi Sam,\n\nI led a team of five engineers. Could you refer me?\n\nThanks",
                  },
                  facts: options.preference
                    ? [
                        {
                          key: "preferences.email.job_links",
                          content:
                            "Do not include job links in referral emails",
                          evidence:
                            "Never mention the same job links in the mail",
                        },
                      ]
                    : [
                        {
                          key: "experience.team_leadership",
                          content: "Led five engineers",
                          evidence: "I led a team of five engineers",
                        },
                      ],
                  profile_updates: [
                    {
                      field: "experience",
                      value: "Led a team of five engineers.",
                      evidence: "I led a team of five engineers",
                    },
                  ],
                }),
              },
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
      if (method !== "GET") writes++;
      if (table === "drafts") {
        if (url.searchParams.get("user_id") !== `eq.${owner}`)
          return new Response(
            JSON.stringify({ code: "PGRST116", message: "not found" }),
            { status: 406 },
          );
        if (method === "PATCH") {
          expect(url.searchParams.get("version")).toBe("eq.1");
          expect(url.searchParams.get("status")).toBe("in.(draft,failed)");
          if (draft.version !== 1) return Response.json([]);
          draft = { ...draft, ...body };
        }
        return rows([draft]);
      }
      if (table === "opportunities")
        return rows([
          {
            id: draftId,
            company: "Example",
            role: "Engineer",
            research: "",
            recipient_name: "Sam",
          },
        ]);
      if (table === "profiles")
        return rows([
          { data: emptyProfile, settings: { model: "openai/gpt-oss-120b" } },
        ]);
      if (table === "relevant_memories") return Response.json([]);
      if (table === "conversations") return new Response(null, { status: 201 });
      if (table === "messages") {
        if (method === "POST") {
          const message = {
            ...body,
            id: `message-${messages.length}`,
            created_at: "now",
          };
          messages.push(message);
          return returning
            ? Response.json(message)
            : new Response(null, { status: 201 });
        }
        return Response.json(messages);
      }
      if (table === "memories") {
        if (method === "GET")
          return rows(
            options.memory ? [{ id: "memory-id", ...options.memory }] : [],
          );
        if (options.memoryFailure)
          return Response.json(
            { message: "database failure" },
            { status: 500 },
          );
        memories.push(body);
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
  return {
    db,
    messages,
    memories,
    draft: () => draft,
    aiCalls: () => aiCalls,
    writes: () => writes,
  };
}
describe("draft assistant", () => {
  test("a lasting email instruction is saved as an editable grounded preference", async () => {
    const app = harness({ preference: true });
    const result = await draftChat(app.db, owner, draftId, {
      content: "Never mention the same job links in the mail",
      version: 1,
    });
    expect(result.reply.memory.saved).toBe(1);
    expect(app.memories[0].key).toBe("preferences.email.job_links");
    expect(app.memories[0].evidence).toBe(
      "Never mention the same job links in the mail",
    );
    expect(app.memories[0].source_message_id).toBe("message-0");
  });
  test("revises the existing draft, preserves addressing/attachments, and saves grounded memory", async () => {
    const app = harness();
    const result = await draftChat(app.db, owner, draftId, {
      content: source,
      version: 1,
    });
    expect(result.draft.version).toBe(2);
    expect(result.draft.cc_emails).toEqual(["team@example.test"]);
    expect(result.draft.bcc_emails).toEqual(["archive@example.test"]);
    expect(result.draft.recipient_email).toBe(
      "sam@example.test, alex@example.test",
    );
    expect(result.draft.attachment_ids).toEqual([draftId]);
    expect(result.reply.draft_updated).toBe(true);
    expect(result.reply.memory).toEqual({
      saved: 1,
      conflicts: 0,
      failed: false,
    });
    expect(app.memories[0].source_message_id).toBe("message-0");
    expect(result.reply.profile_updates).toHaveLength(1);
    expect(readDraftChatReply(String(app.messages[1].content))).toEqual(
      result.reply,
    );
    expect(await draftMessages(app.db, owner, draftId)).toHaveLength(2);
  });
  test("selected email text is context, not evidence for new personal memory", async () => {
    const app = harness();
    const passage = "I led a team of five engineers";
    app.draft().body = passage;
    const result = await draftChat(app.db, owner, draftId, {
      content: "Shorten the selected passage",
      version: 1,
      reference: { text: passage, start: 0, end: passage.length },
    });
    expect(result.reply.memory.saved).toBe(0);
    expect(result.reply.profile_updates).toHaveLength(0);
    expect(String(app.messages[0].content)).toContain(passage);
  });
  test("an outdated selected passage is rejected before AI or writes", async () => {
    const app = harness();
    await expect(
      draftChat(app.db, owner, draftId, {
        content: "Shorten this",
        version: 1,
        reference: { text: "stale text", start: 0, end: 10 },
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(app.aiCalls()).toBe(0);
    expect(app.writes()).toBe(0);
  });
  test("another owner's draft is rejected before AI or writes", async () => {
    const app = harness();
    await expect(
      draftChat(app.db, "someone-else", draftId, {
        content: source,
        version: 1,
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(app.aiCalls()).toBe(0);
    expect(app.writes()).toBe(0);
  });
  test("locked or outdated drafts cannot be changed", async () => {
    const app = harness();
    app.draft().status = "sent";
    await expect(
      draftChat(app.db, owner, draftId, { content: source, version: 1 }),
    ).rejects.toMatchObject({ status: 409 });
    app.draft().status = "draft";
    await expect(
      draftChat(app.db, owner, draftId, { content: source, version: 2 }),
    ).rejects.toMatchObject({ status: 409 });
    expect(app.aiCalls()).toBe(0);
  });
  test("concurrent editing prevents an AI revision overwriting the newer version", async () => {
    const app = harness({ stale: true });
    await expect(
      draftChat(app.db, owner, draftId, { content: source, version: 1 }),
    ).rejects.toMatchObject({ status: 409 });
    expect(app.draft().body).toBe("Edited in another tab");
    expect(
      readDraftChatReply(String(app.messages[1].content))?.draft_updated,
    ).toBe(false);
    expect(app.memories).toHaveLength(0);
  });
  test("memory failure is explicit while the email revision remains saved", async () => {
    const app = harness({ memoryFailure: true });
    const result = await draftChat(app.db, owner, draftId, {
      content: source,
      version: 1,
    });
    expect(result.reply.draft_updated).toBe(true);
    expect(result.reply.memory.failed).toBe(true);
  });
  test("conflicting facts require review, and forgotten facts stay forgotten", async () => {
    const conflict = harness({
      memory: { content: "Led three engineers", status: "active" },
    });
    const result = await draftChat(conflict.db, owner, draftId, {
      content: source,
      version: 1,
    });
    expect(result.reply.memory.conflicts).toBe(1);
    expect(conflict.memories[0].proposal).toBe("Led five engineers");
    const forgotten = harness({ memory: { content: "", status: "forgotten" } });
    const other = await draftChat(forgotten.db, owner, draftId, {
      content: source,
      version: 1,
    });
    expect(other.reply.memory.saved).toBe(0);
    expect(forgotten.memories).toHaveLength(0);
  });
});
test("profile proposals require user evidence and field-valid values, and leave unrelated fields intact", () => {
  const updates: ProfileUpdate[] = [
    {
      field: "experience",
      value: "Led five engineers",
      evidence: "I led a team of five engineers",
    },
    {
      field: "skills",
      value: "Python",
      evidence: "I led a team of five engineers",
    },
    {
      field: "email",
      value: "invalid email",
      evidence: "I led a team of five engineers",
    },
    { field: "summary", value: "Has a PhD", evidence: "I have a PhD" },
  ];
  const grounded = groundedProfileUpdates(updates, source);
  expect(grounded).toHaveLength(1);
  const profile = applyProfileUpdates(
    { ...emptyProfile, name: "Alex", summary: "Software engineer" },
    grounded,
  );
  expect(profile.name).toBe("Alex");
  expect(profile.summary).toBe("Software engineer");
  expect(profile.experience).toBe("Led five engineers");
});
