import { afterEach, expect, mock, test } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@mailer/core/database";
import { z } from "../../apps/web/node_modules/zod";
import { MEMORY_EXTRACTION } from "../../apps/web/lib/server/memory-instructions";
import {
  DEFAULT_MODEL,
  memoryProposalSchema,
} from "../../packages/core/src/index";
mock.module("server-only", () => ({}));
const { prepareReferral } = await import("../../apps/web/lib/server/referral");
const { getSettings, structured, context } =
  await import("../../apps/web/lib/server/ai");
const originalFetch = globalThis.fetch;
const originalKey = process.env.AKASH_API_KEY;
const originalModel = process.env.AKASH_MODEL;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.AKASH_API_KEY;
  else process.env.AKASH_API_KEY = originalKey;
  if (originalModel === undefined) delete process.env.AKASH_MODEL;
  else process.env.AKASH_MODEL = originalModel;
});
function db(model = "openai/gpt-oss-120b") {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { settings: { model } },
            error: null,
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient<Database>;
}
const data = {
  knowledge: {
    profile: {
      name: "Alex Example",
      summary: "Backend engineer building Java APIs",
      skills: ["Java", "PostgreSQL"],
    },
    memories: [],
  },
  opportunity: {
    company: "Forward",
    role: "Senior Software Engineer, Java – Network Team or Software Engineer – Programming Languages Team",
    recipient_name: "Sam",
    input: "Sam shared these two openings",
    research: "",
  },
  signature: "Alex Example",
  hasResume: true,
  instructions: "",
  answers: [],
};
function provider(results: unknown[]) {
  const requests: { model: string; messages: { content: string }[] }[] = [];
  process.env.AKASH_API_KEY = "test-only-key";
  globalThis.fetch = mock(async (_input, init) => {
    requests.push(JSON.parse(String(init?.body)));
    return Response.json({
      id: "test",
      created: 0,
      model: "test",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify(results[requests.length - 1]),
          },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
    });
  }) as unknown as typeof fetch;
  return requests;
}
test("ambiguous role returns owner questions without calling email generation", async () => {
  const requests = provider([
    { questions: ["Which Forward role would you like a referral for?"] },
  ]);
  expect(await prepareReferral(db(), "owner", data)).toEqual({
    kind: "clarification",
    questions: ["Which Forward role would you like a referral for?"],
  });
  expect(requests).toHaveLength(1);
  expect(requests[0].messages[1].content).toContain("Before writing ANY email");
});
test("answers are checked before generating a first-person referral with actual attachment context", async () => {
  const generated = {
    subject: "Referral request — Java Network Team at Forward",
    body: "Hi Sam,\n\nI build Java APIs. Could you refer me for the Java Network Team role? My resume is attached.\n\nAlex Example",
  };
  const requests = provider([{ questions: [] }, generated]);
  expect(
    await prepareReferral(db(), "owner", {
      ...data,
      answers: [{ question: "Which role?", answer: "Java Network Team" }],
    }),
  ).toEqual(generated);
  expect(requests).toHaveLength(2);
  const prompt = requests[1].messages[1].content;
  expect(prompt).toContain("Java Network Team");
  expect(prompt).toContain('"hasResume":true');
  expect(prompt).toContain(
    "Clarification belongs in the conversation with the owner",
  );
  expect(requests.every((request) => request.model === DEFAULT_MODEL)).toBe(
    true,
  );
});
test("incomplete answers trigger another question without writing an email", async () => {
  const requests = provider([{ questions: ["Which team do you mean?"] }]);
  const result = await prepareReferral(db(), "owner", {
    ...data,
    answers: [{ question: "Which role?", answer: "That one" }],
  });
  expect(result).toHaveProperty("kind", "clarification");
  expect(requests).toHaveLength(1);
});
test("legacy model upgrades, while a different explicit model choice is retained", async () => {
  delete process.env.AKASH_MODEL;
  expect((await getSettings(db(), "owner")).model).toBe(DEFAULT_MODEL);
  expect((await getSettings(db("custom-model"), "owner")).model).toBe(
    "custom-model",
  );
});

// Opt-in provider evaluation: uses illustrative data and never saves or sends mail.
test.skipIf(process.env.LIVE_REFERRAL_EVAL !== "1")(
  "live provider resolves the screenshot ambiguity before requesting a referral",
  async () => {
    const client = db(DEFAULT_MODEL);
    const first = await prepareReferral(client, "owner", data);
    expect(first).toHaveProperty("kind", "clarification");
    if (!("kind" in first)) return;
    console.log("Clarification:", first.questions);
    const resolved = await prepareReferral(client, "owner", {
      ...data,
      answers: first.questions.map((question) => ({
        question,
        answer:
          "I want the Senior Software Engineer, Java – Network Team role only. Use my saved Java API background.",
      })),
    });
    expect(resolved).not.toHaveProperty("kind");
    if ("kind" in resolved) return;
    expect(resolved.body).toMatch(/refer|referral/i);
    expect(resolved.body).toMatch(/Java/);
    expect(resolved.body).not.toMatch(/which role|prefer me to|clarification/i);
    console.log("Evaluated draft:", JSON.stringify(resolved));
  },
  300000,
);

test("standing email preferences are included even outside the top-30 search results", async () => {
  const preference = {
    id: "preference",
    key: "preferences.email.job_links",
    content: "Do not include job links",
    proposal: null,
  };
  const stored = {
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        in: () => query,
        like: async () => ({ data: [preference], error: null }),
        maybeSingle: async () => ({ data: { data: {} }, error: null }),
      };
      expect(["profiles", "memories"]).toContain(table);
      return query;
    },
    rpc: async () => ({
      data: Array.from({ length: 30 }, (_, i) => ({
        id: `fact-${i}`,
        key: `experience.fact${i}`,
        content: "Career fact",
        proposal: null,
      })),
      error: null,
    }),
  } as unknown as SupabaseClient<Database>;
  const result = await context(stored, "owner", "Java network role");
  expect(result.memories).toHaveLength(31);
  expect(result.memories).toContainEqual({
    key: preference.key,
    content: preference.content,
    conflict: null,
  });
});

test.skipIf(process.env.LIVE_REFERRAL_EVAL !== "1")(
  "live extraction distinguishes a permanent email preference from a one-off edit",
  async () => {
    const schema = z.object({ facts: z.array(memoryProposalSchema).max(8) });
    const source = "Never mention the same job links in the mail";
    const permanent = await structured(
      db(DEFAULT_MODEL),
      "owner",
      schema,
      `${MEMORY_EXTRACTION}\nUSER DATA: ${JSON.stringify(source)}`,
    );
    expect(
      permanent.facts.some(
        (fact) =>
          fact.key.startsWith("preferences.email.") &&
          fact.evidence === source &&
          /job.*link/i.test(fact.content),
      ),
    ).toBe(true);
    const once = await structured(
      db(DEFAULT_MODEL),
      "owner",
      schema,
      `${MEMORY_EXTRACTION}\nUSER DATA: "Remove this link from this email"`,
    );
    expect(once.facts).toEqual([]);
  },
  300000,
);
