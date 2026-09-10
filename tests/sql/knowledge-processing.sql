-- Run inside a transaction and roll back. Uses one existing workspace only for FKs.
do $$
declare
  fixture_id uuid := gen_random_uuid();
  first_token uuid := gen_random_uuid();
  second_token uuid := gen_random_uuid();
  payload jsonb;
  rejected boolean;
  observed_status text;
begin
  insert into public.knowledge_sources (id, workspace_id, created_by, name, source_type, raw_text, status)
  select fixture_id, workspace_id, created_by, 'Knowledge processing regression fixture', 'text', 'Regression content', 'pending'
  from public.knowledge_sources limit 1;
  if not found then raise exception 'Test requires an existing workspace source'; end if;

  assert public.claim_knowledge_processing(fixture_id, first_token), 'First worker must acquire lease';
  assert not public.claim_knowledge_processing(fixture_id, second_token), 'Duplicate worker must not acquire lease';

  payload := jsonb_build_array(jsonb_build_object('chunk_index', 0, 'content', 'Regression content',
    'embedding', to_jsonb(array_fill(0.05::float8, array[384]))));
  perform public.checkpoint_knowledge_processing(fixture_id, first_token, 'revision-a', payload, 2);
  perform public.checkpoint_knowledge_processing(fixture_id, first_token, 'revision-a', payload, 2);
  assert (select count(*) = 1 from public.knowledge_chunks c where c.source_id = fixture_id), 'Repeated checkpoint must be idempotent';

  rejected := false;
  begin
    perform public.checkpoint_knowledge_processing(fixture_id, first_token, 'revision-a', '[]', 2, true);
  exception when others then
    if sqlerrm <> 'KNOWLEDGE_CHECKPOINT_INCOMPLETE' then raise; end if;
    rejected := true;
  end;
  assert rejected, 'Incomplete source must not become ready';

  update public.knowledge_sources set processing_expires_at = clock_timestamp() - interval '1 second' where id = fixture_id;
  assert public.claim_knowledge_processing(fixture_id, second_token), 'Expired lease must be reclaimable';
  rejected := false;
  begin
    perform public.checkpoint_knowledge_processing(fixture_id, first_token, 'revision-a', payload, 1, true);
  exception when others then
    if sqlerrm <> 'KNOWLEDGE_PROCESSING_LEASE_LOST' then raise; end if;
    rejected := true;
  end;
  assert rejected, 'Stale worker must not publish after takeover';

  perform public.checkpoint_knowledge_processing(fixture_id, second_token, 'revision-b',
    jsonb_set(payload, '{0,chunk_index}', '1'), 2);
  perform public.checkpoint_knowledge_processing(fixture_id, second_token, 'revision-c', payload, 1, true);
  assert (select count(*) = 1 from public.knowledge_chunks c where c.source_id = fixture_id), 'Finalization must remove obsolete chunks';
  select status into observed_status from public.knowledge_sources where id = fixture_id;
  assert observed_status = 'ready', 'Complete source must be published';
  assert not public.claim_knowledge_processing(fixture_id, first_token), 'Ready sources must not be reprocessed accidentally';
  assert not has_function_privilege('authenticated', 'public.claim_knowledge_processing(uuid,uuid)', 'execute');
  assert not has_function_privilege('anon', 'public.checkpoint_knowledge_processing(uuid,uuid,text,jsonb,integer,boolean)', 'execute');
end;
$$;
