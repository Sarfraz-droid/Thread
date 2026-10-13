-- Google Form filler: answers the owner confirmed, reused on later forms,
-- and a history of forms prepared or submitted.
create table public.form_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_key text not null check (char_length(question_key) between 1 and 300),
  question text not null check (char_length(question) <= 1000),
  answer jsonb not null,
  times_used integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, question_key)
);
create table public.form_fills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  form_id text not null,
  form_url text not null,
  title text not null default '',
  answers jsonb not null default '{}',
  mode text not null check (mode in ('prefill', 'submit')),
  status text not null check (status in ('prepared', 'submitted', 'failed')),
  created_at timestamptz not null default now()
);
create index form_fills_recent_idx on public.form_fills (user_id, created_at desc);

do $$
declare tbl text;
begin
  foreach tbl in array array['form_answers', 'form_fills'] loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('revoke all on public.%I from anon, authenticated', tbl);
    execute format('grant select on public.%I to authenticated', tbl);
    execute format('grant all on public.%I to service_role', tbl);
    execute format('create policy owner_read on public.%I for select to authenticated using ((select auth.uid()) = user_id)', tbl);
  end loop;
end $$;
