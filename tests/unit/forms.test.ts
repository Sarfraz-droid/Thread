import { afterEach, describe, expect, mock, test } from "bun:test";
import { createClient } from "../../apps/web/node_modules/@supabase/supabase-js";
import type { Database } from "@mailer/core/database";
import {
  cleanFormAnswers,
  emptyProfile,
  formResponseBody,
  googleFormUrl,
  missingRequired,
  normalizeQuestion,
  parseGoogleForm,
  prefilledFormUrl,
} from "../../packages/core/src/index";
mock.module("server-only", () => ({}));
const { readForm, fillForm } = await import("../../apps/web/lib/server/forms");

const formId = "1FAIpQLSdExampleFormIdentifier";
const formUrl = `https://docs.google.com/forms/d/e/${formId}/viewform`;
const data = [
  null,
  [
    "Tell us about yourself",
    [
      [111, "Full name", null, 0, [[1001, null, 1]]],
      [112, "Why do you want to join?", "A few lines", 1, [[1002, null, 0]]],
      [
        113,
        "Graduation year",
        null,
        2,
        [[1003, [["2024"], ["2025"], ["", null, null, null, 1]], 1]],
      ],
      [114, "Background", null, 8],
      [115, "Skills", null, 4, [[1004, [["TypeScript"], ["Go"], ["Rust"]], 0]]],
      [116, "Rate your interest", null, 5, [[1005, [["1"], ["2"], ["3"]], 0]]],
      [
        117,
        "Availability",
        null,
        7,
        [
          [1006, [["Yes"], ["No"]], 0, ["Weekdays"]],
          [1007, [["Yes"], ["No"]], 0, ["Weekends"]],
        ],
      ],
      [
        118,
        "Start date",
        null,
        9,
        [[1008, null, 0, null, null, null, null, [0, 1]]],
      ],
      [119, "Upload CV", null, 13, [[1009, null, 0]]],
      [120, "", null, 6],
    ],
    null,
    null,
    null,
    null,
    null,
    null,
    "Fellowship application",
    null,
    [null, null, null, null, null, null, 3],
  ],
  "/forms",
  "Fellowship application",
];
const html = `<html><script>var FB_PUBLIC_LOAD_DATA_ = ${JSON.stringify(data)};</script><input type="hidden" name="fbzx" value="-4242"></html>`;

describe("google form parsing", () => {
  const form = parseGoogleForm(html, formId);
  test("reads questions, pages, options, and settings", () => {
    expect(form.title).toBe("Fellowship application");
    expect(form.description).toBe("Tell us about yourself");
    expect(form.pageCount).toBe(2);
    expect(form.fbzx).toBe("-4242");
    expect(form.hasFileUpload).toBe(true);
    expect(form.requiresSignIn).toBe(true);
    expect(form.skipped).toEqual(["Upload CV"]);
    expect(form.questions.map((q) => [q.entryId, q.kind])).toEqual([
      ["emailAddress", "short"],
      ["1001", "short"],
      ["1002", "paragraph"],
      ["1003", "choice"],
      ["1004", "checkboxes"],
      ["1005", "scale"],
      ["1006", "choice"],
      ["1007", "choice"],
      ["1008", "date"],
    ]);
    // The "Other" option has no fixed value and is left out.
    expect(form.questions[3].options).toEqual(["2024", "2025"]);
    expect(form.questions[6].title).toBe("Availability — Weekdays");
    expect(form.questions[1].required).toBe(true);
  });
  test("cleans answers to what the form accepts", () => {
    const answers = cleanFormAnswers(form, {
      "1001": "  Alex\nExample ",
      "1003": "2025",
      "1004": ["typescript", "Haskell"],
      "1005": "7",
      "1008": "2026-01-15",
    });
    expect(answers).toEqual({
      "1001": "Alex Example",
      "1003": "2025",
      "1004": ["TypeScript"],
      "1008": "2026-01-15",
    });
    expect(missingRequired(form, answers).map((q) => q.entryId)).toEqual([
      "emailAddress",
    ]);
  });
  test("builds a prefilled link and a submission body", () => {
    const answers = {
      emailAddress: "alex@example.test",
      "1001": "Alex Example",
      "1004": ["TypeScript", "Go"],
      "1008": "2026-01-15",
    };
    const url = new URL(prefilledFormUrl(form, answers));
    expect(url.pathname).toBe(`/forms/d/e/${formId}/viewform`);
    expect(url.searchParams.get("usp")).toBe("pp_url");
    expect(url.searchParams.getAll("entry.1004")).toEqual(["TypeScript", "Go"]);
    expect(url.searchParams.get("emailAddress")).toBe("alex@example.test");
    const body = formResponseBody(form, answers);
    expect(body.get("entry.1008_year")).toBe("2026");
    expect(body.get("entry.1008_day")).toBe("15");
    expect(body.get("pageHistory")).toBe("0,1");
    expect(body.get("fbzx")).toBe("-4242");
  });
  test("only Google Forms links are accepted", () => {
    expect(googleFormUrl("https://forms.gle/abc123").hostname).toBe(
      "forms.gle",
    );
    expect(() => googleFormUrl("https://example.com/forms/d/e/x")).toThrow();
    expect(() =>
      googleFormUrl("https://docs.google.com/document/d/abc/edit"),
    ).toThrow();
    expect(() =>
      googleFormUrl("https://docs.google.com/forms/d/abc/edit"),
    ).toThrow("editor");
  });
  test("question wording normalizes across forms", () => {
    expect(normalizeQuestion("Full Name *")).toBe(
      normalizeQuestion("full name"),
    );
  });
});

const owner = "11111111-1111-4111-8111-111111111111";
const originalFetch = globalThis.fetch;
const originalKey = process.env.AKASH_API_KEY;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.AKASH_API_KEY;
  else process.env.AKASH_API_KEY = originalKey;
});
// The public form (no email or upload) for read and submit flows.
const publicData = structuredClone(data) as unknown[];
(publicData[1] as unknown[])[1] = (
  (publicData[1] as unknown[])[1] as unknown[][]
).filter((item) => item[3] !== 13);
((publicData[1] as unknown[])[10] as unknown[])[6] = 1;
const publicHtml = `<script>var FB_PUBLIC_LOAD_DATA_ = ${JSON.stringify(publicData)};</script><input name="fbzx" value="-1">`;
function harness() {
  const upserts: Record<string, unknown>[][] = [];
  const fills: Record<string, unknown>[] = [];
  const submissions: URLSearchParams[] = [];
  let aiPrompt = "";
  const fetcher = mock(
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input
            : input.url,
      );
      if (url.hostname === "forms.gle")
        return new Response(null, {
          status: 302,
          headers: { location: formUrl },
        });
      if (url.hostname === "docs.google.com") {
        if (url.pathname.endsWith("/formResponse")) {
          submissions.push(new URLSearchParams(String(init?.body)));
          return new Response("ok");
        }
        return new Response(publicHtml);
      }
      if (url.host === "api.akashml.com") {
        aiPrompt = String(init?.body);
        return Response.json({
          id: "t",
          model: "t",
          created: 0,
          choices: [
            {
              index: 0,
              finish_reason: "stop",
              message: {
                role: "assistant",
                content: JSON.stringify({
                  answers: [
                    { entryId: "1003", value: "2025", note: "" },
                    {
                      entryId: "1004",
                      value: ["TypeScript", "COBOL"],
                      note: "",
                    },
                    {
                      entryId: "1002",
                      value: null,
                      note: "Only you can say why you want to join.",
                    },
                  ],
                }),
              },
            },
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        });
      }
      const table = url.pathname.split("/").at(-1);
      const method = init?.method ?? "GET";
      const body =
        typeof init?.body === "string" ? JSON.parse(init.body) : null;
      if (table === "form_answers") {
        if (method === "POST") {
          upserts.push(body);
          return new Response(null, { status: 201 });
        }
        if (url.searchParams.has("question_key"))
          return Response.json([{ question_key: "full name", times_used: 2 }]);
        return Response.json([
          {
            id: "a1",
            question_key: "full name",
            question: "Full name",
            answer: "Alex Example",
            times_used: 2,
            updated_at: "now",
          },
        ]);
      }
      if (table === "form_fills") {
        fills.push(body);
        return new Response(null, { status: 201 });
      }
      if (table === "profiles")
        return Response.json(
          new Headers(init?.headers).get("accept")?.includes("vnd.pgrst.object")
            ? { data: emptyProfile, settings: { model: "m" } }
            : [{ data: emptyProfile, settings: { model: "m" } }],
        );
      if (table === "relevant_memories" || table === "memories")
        return Response.json([]);
      throw new Error(`Unexpected test request: ${url.href}`);
    },
  );
  globalThis.fetch = fetcher as unknown as typeof fetch;
  process.env.AKASH_API_KEY = "test-only-key";
  const db = createClient<Database>("https://db.example.test", "test-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetcher as unknown as typeof fetch },
  });
  return { db, upserts, fills, submissions, aiPrompt: () => aiPrompt };
}

describe("form filler", () => {
  test("reuses remembered answers and suggests only supported ones", async () => {
    const app = harness();
    const result = await readForm(app.db, owner, {
      url: "https://forms.gle/abc123",
    });
    expect(result.url).toBe(formUrl);
    expect(result.answers["1001"]).toEqual({
      value: "Alex Example",
      source: "memory",
    });
    expect(result.answers["1003"].source).toBe("suggested");
    // An option the form does not offer is dropped, not invented.
    expect(result.answers["1004"].value).toEqual(["TypeScript"]);
    expect(result.answers["1002"]).toEqual({
      value: null,
      source: "needs_you",
      note: "Only you can say why you want to join.",
    });
    // Remembered questions are not sent to the model again.
    expect(app.aiPrompt()).toContain('\\"entryId\\":\\"1003\\"');
    expect(app.aiPrompt()).not.toContain('\\"entryId\\":\\"1001\\"');
  });
  test("submits a public form and remembers the confirmed answers", async () => {
    const app = harness();
    const result = await fillForm(app.db, owner, {
      url: formUrl,
      mode: "submit",
      answers: { "1001": "Alex Example", "1003": "2025", "1004": ["Go"] },
    });
    expect(result.status).toBe("submitted");
    expect(app.submissions[0].get("entry.1003")).toBe("2025");
    expect(app.submissions[0].getAll("entry.1004")).toEqual(["Go"]);
    const saved = app.upserts[0];
    expect(saved.map((row) => row.question_key)).toEqual([
      "full name",
      "graduation year",
      "skills",
    ]);
    expect(saved[0].times_used).toBe(3);
    expect(saved[2].answer).toEqual(["Go"]);
    expect(app.fills[0]).toMatchObject({ mode: "submit", status: "submitted" });
  });
  test("a missing required answer blocks direct submission", async () => {
    const app = harness();
    await expect(
      fillForm(app.db, owner, {
        url: formUrl,
        mode: "submit",
        remember: false,
        answers: { "1001": "Alex Example" },
      }),
    ).rejects.toThrow("Graduation year");
    expect(app.submissions).toHaveLength(0);
  });
});
