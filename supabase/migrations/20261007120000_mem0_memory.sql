-- Vector store for the Mem0 memory layer. Mem0 reaches it through a direct
-- Postgres connection (MEM0_DATABASE_URL), never through PostgREST, so row level
-- security stays on with no policies: browser and anon roles cannot read it.
-- The vector dimension must match MEM0_EMBEDDING_DIMS (default 768).
create extension if not exists vector with schema extensions;

create table if not exists public.mem0_memories (
  id uuid primary key,
  vector extensions.vector(768),
  payload jsonb
);
create index if not exists mem0_memories_vector_idx
  on public.mem0_memories using hnsw (vector extensions.vector_cosine_ops);
create index if not exists mem0_memories_user_idx
  on public.mem0_memories ((payload ->> 'user_id'));
alter table public.mem0_memories enable row level security;
revoke all on public.mem0_memories from anon, authenticated;

-- Mem0 creates this bookkeeping table on first connection; create it here so it
-- is protected the same way.
create table if not exists public.memory_migrations (
  id serial primary key,
  user_id text not null unique
);
alter table public.memory_migrations enable row level security;
revoke all on public.memory_migrations from anon, authenticated;
