import { afterEach, describe, expect, mock, test } from "bun:test";
mock.module("server-only", () => ({}));
const { mem0Configured, mem0Llm, toMemory } =
  await import("../../apps/web/lib/server/mem0");

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe("memory layer", () => {
  test("is only active when both the database and embeddings are configured", () => {
    delete process.env.MEM0_DATABASE_URL;
    delete process.env.MEM0_EMBEDDING_API_KEY;
    expect(mem0Configured()).toBe(false);
    process.env.MEM0_DATABASE_URL = "postgresql://localhost/db";
    expect(mem0Configured()).toBe(false);
    process.env.MEM0_EMBEDDING_API_KEY = "key";
    expect(mem0Configured()).toBe(true);
  });
  test("maps stored items to workspace memories with provenance", () => {
    const memory = toMemory("owner", {
      id: "m1",
      memory: "Worked as a backend engineer at Acme",
      createdAt: "2026-10-07T00:00:00.000Z",
      metadata: { source_message_id: "msg", source_excerpt: "I was at Acme" },
    });
    expect(memory).toMatchObject({
      id: "m1",
      user_id: "owner",
      content: "Worked as a backend engineer at Acme",
      evidence: "I was at Acme",
      source_message_id: "msg",
      status: "active",
      proposal: null,
      updated_at: "2026-10-07T00:00:00.000Z",
    });
    expect(toMemory("owner", { id: "m2", memory: "x" }).evidence).toBe(
      "Learned by your memory layer",
    );
  });
  test("extraction uses the selected provider's endpoint and key", () => {
    process.env.AKASH_API_KEY = "akash-key";
    process.env.TOGETHER_API_KEY = "together-key";
    expect(mem0Llm("akash", "m")).toEqual({
      baseURL: "https://api.akashml.com/v1",
      apiKey: "akash-key",
      model: "m",
    });
    expect(mem0Llm("together", "t").baseURL).toBe("https://api.together.ai/v1");
    expect(mem0Llm("vercel", "v").baseURL).toBe(
      "https://ai-gateway.vercel.sh/v1",
    );
  });
});
