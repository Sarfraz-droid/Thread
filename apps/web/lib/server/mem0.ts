import "server-only";
import type { Memory as Mem0Client } from "mem0ai/oss";
import type { Memory } from "@mailer/core";
import type { AiProvider } from "@mailer/core";
import {
  compatibleBaseUrl,
  providerKeyName,
  selectedAiProvider,
  usesGateway,
} from "./ai-provider";

// Mem0 owns extraction, deduplication, updates and semantic retrieval. Vectors
// live in this project's Postgres (mem0_memories); it is enabled by configuring
// MEM0_DATABASE_URL and MEM0_EMBEDDING_API_KEY, otherwise the built-in memory
// table keeps working unchanged.
export const MEM0_INSTRUCTIONS = `Save durable facts the owner states about themselves: work experience, roles, employers, projects, skills, education, achievements, career goals, location and work preferences, and standing preferences for how emails should be written. Learn only from what the owner types. Ignore assistant replies, pasted referral messages, job descriptions, email drafts, and research. Skip sensitive details (health, finances, identity numbers, credentials), hypotheticals, and one-off requests about the current task.`;

export function mem0Configured() {
  return Boolean(
    process.env.MEM0_DATABASE_URL && process.env.MEM0_EMBEDDING_API_KEY,
  );
}

type LlmTarget = { baseURL: string; apiKey: string; model: string };
export function mem0Llm(provider: AiProvider | undefined, model: string) {
  const selected = selectedAiProvider(provider);
  return {
    baseURL: usesGateway(selected)
      ? "https://ai-gateway.vercel.sh/v1"
      : compatibleBaseUrl(selected),
    apiKey: process.env[providerKeyName(selected)] ?? "",
    model,
  } satisfies LlmTarget;
}

const dimensions = () => Number(process.env.MEM0_EMBEDDING_DIMS || 768);
const clients = new Map<string, Promise<Mem0Client>>();
async function client(llm: LlmTarget) {
  const dims = dimensions();
  const cacheKey = `${llm.baseURL}|${llm.model}`;
  let existing = clients.get(cacheKey);
  if (!existing) {
    existing = import("mem0ai/oss").then(
      ({ Memory: Mem0 }) =>
        new Mem0({
          version: "v1.1",
          // History is only an audit trail and would need a native SQLite file,
          // which serverless hosting cannot persist.
          disableHistory: true,
          customInstructions: MEM0_INSTRUCTIONS,
          llm: { provider: "openai", config: llm },
          embedder: {
            provider: "openai",
            config: {
              apiKey: process.env.MEM0_EMBEDDING_API_KEY,
              baseURL:
                process.env.MEM0_EMBEDDING_BASE_URL ||
                "https://openrouter.ai/api/v1",
              model:
                process.env.MEM0_EMBEDDING_MODEL || "baai/bge-base-en-v1.5",
            },
          },
          vectorStore: {
            provider: "pgvector",
            config: {
              collectionName: "mem0_memories",
              connectionString: process.env.MEM0_DATABASE_URL,
              embeddingModelDims: dims,
              dimension: dims,
              ssl: /localhost|127\.0\.0\.1/.test(
                process.env.MEM0_DATABASE_URL ?? "",
              )
                ? undefined
                : { rejectUnauthorized: false },
            },
          },
        }),
    );
    // A failed start must be retried rather than cached forever.
    existing.catch(() => clients.delete(cacheKey));
    clients.set(cacheKey, existing);
  }
  return existing;
}

type Item = {
  id: string;
  memory: string;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
  user_id?: string;
};
export function toMemory(userId: string, item: Item): Memory {
  const text = (value: unknown) =>
    typeof value === "string" && value ? value : null;
  const meta = item.metadata ?? {};
  const created = item.createdAt ?? new Date().toISOString();
  return {
    id: item.id,
    user_id: userId,
    key: text(meta.key) ?? "memory",
    content: item.memory,
    evidence: text(meta.source_excerpt) ?? "Learned by your memory layer",
    source_message_id: text(meta.source_message_id),
    status: "active",
    proposal: null,
    created_at: created,
    updated_at: item.updatedAt ?? created,
  };
}

export async function mem0Learn(
  llm: LlmTarget,
  userId: string,
  messageId: string,
  content: string,
  question?: string,
) {
  const mem0 = await client(llm);
  const result = await mem0.add(
    [
      ...(question ? [{ role: "assistant" as const, content: question }] : []),
      { role: "user" as const, content },
    ],
    {
      userId,
      metadata: {
        source_message_id: messageId,
        source_excerpt: content.slice(0, 300),
      },
    },
  );
  const changed = (result.results ?? []).filter(
    (r: { metadata?: { event?: string } }) => r.metadata?.event !== "NONE",
  );
  return { saved: changed.length, conflicts: 0 };
}
export async function mem0Add(
  llm: LlmTarget,
  userId: string,
  key: string,
  content: string,
) {
  const mem0 = await client(llm);
  // infer:false stores the owner's exact wording instead of an LLM paraphrase.
  const result = await mem0.add([{ role: "user", content }], {
    userId,
    infer: false,
    metadata: { key, source_excerpt: "Manually added by owner" },
  });
  return result.results?.[0]?.id as string | undefined;
}
export async function mem0Search(
  llm: LlmTarget,
  userId: string,
  query: string,
  topK = 15,
) {
  const mem0 = await client(llm);
  const found = await mem0.search(query, {
    filters: { user_id: userId },
    topK,
  });
  return (found.results ?? []).map((item) => toMemory(userId, item));
}
export async function mem0List(llm: LlmTarget, userId: string) {
  const mem0 = await client(llm);
  const all = await mem0.getAll({ filters: { user_id: userId }, topK: 500 });
  return (all.results ?? [])
    .map((item) => toMemory(userId, item))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}
// Resolve a memory only when it belongs to this owner, so an id from another
// scope can never be read, edited or deleted.
export async function mem0Owned(llm: LlmTarget, userId: string, id: string) {
  const mem0 = await client(llm);
  const item = (await mem0.get(id)) as Item | null;
  return item && item.user_id === userId ? toMemory(userId, item) : null;
}
export async function mem0Update(llm: LlmTarget, id: string, text: string) {
  await (await client(llm)).update(id, { text });
}
export async function mem0Forget(llm: LlmTarget, id: string) {
  await (await client(llm)).delete(id);
}
