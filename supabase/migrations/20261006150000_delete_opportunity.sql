-- Keep ownership checks, send guards and cascading cleanup in one transaction.
create function public.delete_opportunity(p_user_id uuid, p_opportunity_id uuid)
returns boolean language plpgsql security invoker set search_path = public as $$
declare draft_ids uuid[];
begin
  perform 1 from opportunities where id=p_opportunity_id and user_id=p_user_id for update nowait;
  if not found then return false; end if;
  -- NOWAIT avoids deadlocks with delivery completion, which locks drafts first.
  perform 1 from drafts where opportunity_id=p_opportunity_id and user_id=p_user_id order by id for update nowait;
  if exists(select 1 from drafts where opportunity_id=p_opportunity_id and user_id=p_user_id and status in ('sending','unknown')) then
    raise exception 'Resolve the pending or uncertain email delivery before deleting this opportunity' using errcode='P0001';
  end if;
  select coalesce(array_agg(id), '{}') into draft_ids from drafts where opportunity_id=p_opportunity_id and user_id=p_user_id;
  -- Personal memories survive removal of their original draft conversation.
  update memories set source_message_id=null where user_id=p_user_id and source_message_id in
    (select id from messages where user_id=p_user_id and conversation_id=any(draft_ids));
  update memories set conflict_source_message_id=null where user_id=p_user_id and conflict_source_message_id in
    (select id from messages where user_id=p_user_id and conversation_id=any(draft_ids));
  delete from conversations where user_id=p_user_id and id=any(draft_ids);
  -- Existing foreign keys cascade to research, drafts and send attempts.
  delete from opportunities where id=p_opportunity_id and user_id=p_user_id;
  return true;
end $$;
revoke all on function public.delete_opportunity(uuid,uuid) from public,anon,authenticated;
grant execute on function public.delete_opportunity(uuid,uuid) to service_role;
