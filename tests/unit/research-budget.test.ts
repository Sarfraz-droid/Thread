import { afterEach, expect, mock, test } from "bun:test";
import { createClient } from "../../apps/web/node_modules/@supabase/supabase-js";
import type { Database } from "@mailer/core/database";
mock.module("server-only", () => ({}));
const { research } = await import("../../apps/web/lib/server/research");
const originalFetch = globalThis.fetch;
const originalKey = process.env.GROQ_API_KEY;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = originalKey;
});

test("research retries oversized requests with less evidence and output while preserving source storage", async () => {
  process.env.GROQ_API_KEY = "test-key";
  const opportunity = {
    id: "test",
    company: "Example",
    role: "Engineer",
    job_id: "42",
    job_url: "",
    instructions: "",
    research: "",
    status: "new",
    input: "original input ".repeat(3000),
  };
  const content = "Evidence about engineering roles. ".repeat(300);
  let savedSourceLength = 0;
  const db = createClient<Database>("https://example.test", "test", {
    global: {
      fetch: async (input, init) => {
        const url = String(input);
        if (url.includes("profiles"))
          return Response.json({
            settings: { provider: "groq", model: "openai/gpt-oss-20b" },
          });
        if (url.includes("research_sources")) {
          savedSourceLength = JSON.parse(String(init?.body))[0].content.length;
          return new Response(null, { status: 201 });
        }
        if (init?.method === "PATCH")
          return Response.json({
            ...opportunity,
            ...JSON.parse(String(init.body)),
          });
        return Response.json(opportunity);
      },
    },
  });
  const requests: { max_tokens: number; messages: { content: string }[] }[] =
    [];
  globalThis.fetch = Object.assign(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("api.tavily.com"))
        return Response.json({
          results: [
            {
              url: "https://example.com/careers",
              title: "Careers",
              raw_content: content,
            },
          ],
        });
      requests.push(JSON.parse(String(init?.body)));
      if (requests.length === 1)
        return Response.json(
          { error: { message: "Request too large", type: "tokens" } },
          { status: 413 },
        );
      return Response.json({
        id: "test",
        object: "chat.completion",
        created: 1,
        model: "openai/gpt-oss-20b",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content:
                '{"summary":"Evidence summary https://example.com/careers"}',
            },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      });
    },
    { preconnect: originalFetch.preconnect },
  );
  const oldSearchKey = process.env.TAVILY_API_KEY;
  process.env.TAVILY_API_KEY = "test-search-key";
  try {
    const result = await research(db, "owner", "test");
    expect(result.research).toContain("Evidence summary");
    expect(requests).toHaveLength(2);
    expect(requests[0].max_tokens).toBe(1800);
    expect(requests[1].max_tokens).toBe(1200);
    const first = requests[0].messages.at(-1)!.content;
    const second = requests[1].messages.at(-1)!.content;
    expect(second.length).toBeLessThan(first.length);
    expect(second).toContain("https://example.com/careers");
    expect(first).not.toContain("original input");
    expect(savedSourceLength).toBe(content.length);
  } finally {
    if (oldSearchKey === undefined) delete process.env.TAVILY_API_KEY;
    else process.env.TAVILY_API_KEY = oldSearchKey;
  }
});
