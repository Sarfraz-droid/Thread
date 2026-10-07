create extension if not exists pgcrypto;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}',
  settings jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
create table public.conversations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'A new conversation', summary text not null default '',
  created_at timestamptz not null default now(), unique(id, user_id)
);
create table public.messages (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null, role text not null check(role in ('user','assistant')),
  content text not null, excluded_from_context boolean not null default false,
  created_at timestamptz not null default now(), unique(id,user_id),
  foreign key(conversation_id,user_id) references public.conversations(id,user_id) on delete cascade
);
create index messages_conversation_idx on public.messages(user_id,conversation_id,created_at);
create table public.memories (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  key text not null, content text not null, evidence text not null default '',
  source_message_id uuid, conflict_source_message_id uuid,
  status text not null default 'active' check(status in ('active','conflict','forgotten')),
  proposal text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  search tsvector generated always as (to_tsvector('english',coalesce(content,'') || ' ' || key)) stored,
  unique(user_id,key),
  foreign key(source_message_id,user_id) references public.messages(id,user_id),
  foreign key(conflict_source_message_id,user_id) references public.messages(id,user_id)
);
create index memories_search_idx on public.memories using gin(search);
create table public.documents (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, path text not null unique, mime_type text not null,
  size integer not null check(size > 0 and size <= 10485760), text text not null default '',
  kind text not null check(kind in ('resume','referral','attachment')), is_default boolean not null default false,
  created_at timestamptz not null default now(), unique(id,user_id)
);
create unique index documents_one_default_idx on public.documents(user_id) where is_default;
create table public.opportunities (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  input text not null, document_id uuid,
  company text not null default '', role text not null default '', recipient_name text not null default '',
  recipient_email text not null default '', job_url text not null default '', job_id text not null default '',
  instructions text not null default '', notes text not null default '', research text not null default '',
  status text not null default 'new' check(status in ('new','researched','drafted','sent')),
  outcome text not null default 'pending' check(outcome in ('pending','replied','interview','closed')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id),
  foreign key(document_id,user_id) references public.documents(id,user_id)
);
create table public.research_sources (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid not null, url text not null, title text not null, content text not null,
  retrieved_at timestamptz not null default now(),
  foreign key(opportunity_id,user_id) references public.opportunities(id,user_id) on delete cascade,
  unique(opportunity_id,url)
);
create table public.drafts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid not null, recipient_email text not null, subject text not null, body text not null,
  attachment_ids uuid[] not null default '{}', version integer not null default 1,
  status text not null default 'draft' check(status in ('draft','sending','sent','failed','unknown')),
  gmail_message_id text, sent_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,user_id),
  foreign key(opportunity_id,user_id) references public.opportunities(id,user_id) on delete cascade
);
create table public.send_attempts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  draft_id uuid not null, idempotency_key uuid not null, status text not null default 'sending' check(status in ('sending','sent','failed','unknown')),
  snapshot jsonb not null, gmail_message_id text, error text,
  created_at timestamptz not null default now(), finished_at timestamptz,
  foreign key(draft_id,user_id) references public.drafts(id,user_id) on delete cascade,
  unique(user_id,idempotency_key)
);
create table public.mcp_configs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, url text not null, enabled boolean not null default false,
  allowed_tools text[] not null default '{}', unique(id,user_id)
);
create table public.integration_credentials (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check(kind in ('gmail','mcp')), reference text not null,
  encrypted_payload text not null, updated_at timestamptz not null default now(), unique(user_id,kind,reference)
);
alter table public.integration_credentials enable row level security;
revoke all on public.integration_credentials from anon, authenticated;
grant all on public.integration_credentials to service_role;

-- Client reads are ownership scoped. Writes involving AI, email, or integration state
-- go through authenticated server endpoints and explicit ownership checks.
do $$
declare tbl text;
begin
  foreach tbl in array array['profiles','conversations','messages','memories','documents','opportunities','research_sources','drafts','send_attempts','mcp_configs'] loop
    execute format('alter table public.%I enable row level security',tbl);
    execute format('revoke all on public.%I from anon, authenticated',tbl);
    execute format('grant select on public.%I to authenticated',tbl);
    execute format('grant all on public.%I to service_role',tbl);
    execute format('create policy owner_read on public.%I for select to authenticated using ((select auth.uid()) = user_id)',tbl);
    execute format('create index %I on public.%I(user_id)',tbl || '_owner_idx',tbl);
  end loop;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('documents','documents',false,10485760,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/png','image/jpeg','text/plain'])
on conflict(id) do nothing;
create policy owner_document_read on storage.objects for select to authenticated
using(bucket_id='documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
-- Uploads use a short-lived signed upload token issued only by the owner-only API.

create function public.claim_send(p_user_id uuid, p_draft_id uuid, p_version integer, p_key uuid, p_snapshot jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare attempt_id uuid;
begin
  if exists(select 1 from send_attempts where user_id=p_user_id and idempotency_key=p_key) then
    raise exception 'This send request has already been processed' using errcode='P0001';
  end if;
  update drafts set status='sending',updated_at=now()
    where id=p_draft_id and user_id=p_user_id and version=p_version and status in ('draft','failed');
  if not found then raise exception 'Draft changed or has already been sent' using errcode='P0001'; end if;
  insert into send_attempts(user_id,draft_id,idempotency_key,snapshot)
    values(p_user_id,p_draft_id,p_key,p_snapshot) returning id into attempt_id;
  return attempt_id;
end $$;
revoke all on function public.claim_send(uuid,uuid,integer,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.claim_send(uuid,uuid,integer,uuid,jsonb) to service_role;

create function public.finish_send(p_user_id uuid,p_attempt_id uuid,p_status text,p_message_id text,p_error text)
returns void language plpgsql security invoker set search_path = public as $$
declare did uuid; oid uuid;
begin
  if p_status not in ('sent','failed','unknown') then raise exception 'Invalid send outcome'; end if;
  update send_attempts set status=p_status,gmail_message_id=p_message_id,error=p_error,finished_at=now()
    where id=p_attempt_id and user_id=p_user_id and status='sending' returning draft_id into did;
  if did is null then raise exception 'Send attempt is no longer pending'; end if;
  update drafts set status=p_status,gmail_message_id=p_message_id,
    sent_at=case when p_status='sent' then now() else null end,updated_at=now()
    where id=did and user_id=p_user_id returning opportunity_id into oid;
  if p_status='sent' then update opportunities set status='sent',updated_at=now() where id=oid and user_id=p_user_id; end if;
end $$;
revoke all on function public.finish_send(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.finish_send(uuid,uuid,text,text,text) to service_role;

create function public.set_default_document(p_user_id uuid,p_document_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
begin
  perform 1 from profiles where user_id=p_user_id for update;
  if not exists(select 1 from documents where id=p_document_id and user_id=p_user_id and kind='resume') then raise exception 'Resume not found'; end if;
  update documents set is_default=false where user_id=p_user_id and is_default;
  update documents set is_default=true where user_id=p_user_id and id=p_document_id;
end $$;
revoke all on function public.set_default_document(uuid,uuid) from public,anon,authenticated;
grant execute on function public.set_default_document(uuid,uuid) to service_role;

create function public.relevant_memories(p_user_id uuid,p_query text)
returns setof public.memories language sql security invoker set search_path = public as $$
  select * from memories where user_id=p_user_id and status in ('active','conflict')
  order by ts_rank(search,websearch_to_tsquery('english',left(p_query,2000))) desc,updated_at desc limit 30;
$$;
revoke all on function public.relevant_memories(uuid,text) from public,anon,authenticated;
grant execute on function public.relevant_memories(uuid,text) to service_role;
