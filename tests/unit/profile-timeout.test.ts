import { afterEach, expect, mock, test } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@mailer/core/database";
import { errorResponse } from "../../apps/web/lib/server/errors";

mock.module("server-only", () => ({}));
const { extractProfile } = await import("../../apps/web/lib/server/ai");
const originalFetch = globalThis.fetch;
const originalTimeout = AbortSignal.timeout;
const originalKey = process.env.AKASH_API_KEY;
afterEach(() => {
  globalThis.fetch = originalFetch;
  AbortSignal.timeout = originalTimeout;
  if (originalKey === undefined) delete process.env.AKASH_API_KEY;
  else process.env.AKASH_API_KEY = originalKey;
});
const db = {
  from: () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: { settings: {} }, error: null }),
      }),
    }),
  }),
} as unknown as SupabaseClient<Database>;

test("resume extraction can finish after the old 60-second deadline", async () => {
  process.env.AKASH_API_KEY = "test-only-key";
  const deadlines: number[] = [];
  AbortSignal.timeout = (milliseconds) => {
    deadlines.push(milliseconds);
    return originalTimeout(milliseconds <= 60000 ? 5 : 1000);
  };
  globalThis.fetch = mock(async (_input, init) => {
    const signal = init?.signal;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 15);
      signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(signal.reason);
        },
        { once: true },
      );
    });
    return Response.json({
      id: "test",
      created: 0,
      model: "test",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: '{"name":"Resume Candidate"}',
          },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
    });
  }) as unknown as typeof fetch;
  expect((await extractProfile(db, "owner", "Resume Candidate")).name).toBe(
    "Resume Candidate",
  );
  expect(deadlines).toHaveLength(1);
  expect(deadlines[0]).toBeLessThan(300000);
});

test("JSON repair shares the same deadline", async () => {
  process.env.AKASH_API_KEY = "test-only-key";
  const signals: (AbortSignal | null | undefined)[] = [];
  globalThis.fetch = mock(async (_input, init) => {
    signals.push(init?.signal);
    return Response.json({
      id: "test",
      created: 0,
      model: "test",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content:
              signals.length === 1
                ? "invalid JSON"
                : '{"name":"Resume Candidate"}',
          },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
    });
  }) as unknown as typeof fetch;
  expect((await extractProfile(db, "owner", "Resume Candidate")).name).toBe(
    "Resume Candidate",
  );
  expect(signals).toHaveLength(2);
  expect(signals[0]).toBeInstanceOf(AbortSignal);
  expect(signals[1]).toBe(signals[0]);
});

test("provider timeouts return an actionable gateway timeout", async () => {
  const response = errorResponse(
    new DOMException("The operation timed out", "TimeoutError"),
  );
  expect(response.status).toBe(504);
  expect((await response.json()).error).toContain("timed out");
});
