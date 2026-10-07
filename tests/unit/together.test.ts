import { afterEach, expect, mock, test } from "bun:test";
import { createClient } from "../../apps/web/node_modules/@supabase/supabase-js";
import { z } from "../../apps/web/node_modules/zod";
import type { Database } from "@mailer/core/database";
mock.module("server-only", () => ({}));
const { structured, getSettings } =
  await import("../../apps/web/lib/server/ai");
const { selectedAiProvider, defaultAiModel } =
  await import("../../apps/web/lib/server/ai-provider");
const originalFetch = globalThis.fetch;
const originalEnv = {
  AI_PROVIDER: process.env.AI_PROVIDER,
  TOGETHER_API_KEY: process.env.TOGETHER_API_KEY,
  TOGETHER_MODEL: process.env.TOGETHER_MODEL,
};
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
function db(model = "MiniMaxAI/MiniMax-M3") {
  return createClient<Database>("https://example.test", "test", {
    global: {
      fetch: async () =>
        Response.json({
          settings: { provider: "together", model },
        }),
    },
  });
}
test("Together selection uses its endpoint, key and model even when AkashML is the environment default", async () => {
  process.env.AI_PROVIDER = "akash";
  process.env.TOGETHER_API_KEY = "test-together-key";
  let endpoint = "",
    authorization = "",
    requestModel = "";
  globalThis.fetch = Object.assign(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      endpoint = String(input);
      authorization = new Headers(init?.headers).get("Authorization") ?? "";
      requestModel = JSON.parse(String(init?.body)).model;
      return Response.json({
        id: "test",
        object: "chat.completion",
        created: 1,
        model: requestModel,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: '{"message":"Together response"}',
            },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      });
    },
    { preconnect: originalFetch.preconnect },
  );
  const result = await structured(
    db(),
    "owner",
    z.object({ message: z.string() }),
    "Hello",
  );
  expect(endpoint).toBe("https://api.together.ai/v1/chat/completions");
  expect(authorization).toBe("Bearer test-together-key");
  expect(requestModel).toBe("MiniMaxAI/MiniMax-M3");
  expect(result.message).toBe("Together response");
});
test("Together selection requires its own key without silently falling back", async () => {
  delete process.env.TOGETHER_API_KEY;
  await expect(
    structured(db(), "owner", z.object({ message: z.string() }), "Hello"),
  ).rejects.toThrow("Configure TOGETHER_API_KEY");
});
test("Together environment default resolves its configurable model", () => {
  process.env.AI_PROVIDER = "together";
  process.env.TOGETHER_MODEL = "custom-together-model";
  expect(selectedAiProvider()).toBe("together");
  expect(defaultAiModel()).toBe("custom-together-model");
});

test("explicit Together model choices are preserved", async () => {
  expect((await getSettings(db("openai/gpt-oss-120b"), "owner")).model).toBe(
    "openai/gpt-oss-120b",
  );
});
