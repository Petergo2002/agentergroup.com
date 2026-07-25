-- Phase 1C: import an approved Agent Library template through the same
-- canonical creation transaction used by blank Agents. Knowledge snapshots,
-- quota reservations, Agent links, and the initial draft update commit or
-- roll back together. The private request ledger makes browser retries safe.

create table if not exists private.agent_template_import_requests (
  workspace_id uuid not null
    references public.workspaces (id) on delete cascade,
  request_id uuid not null,
  actor_id uuid not null
    references public.profiles (id) on delete cascade,
  template_id uuid not null,
  identity_kind text not null
    check (
      identity_kind in (
        'website',
        'automation',
        'assistant',
        'legacy_widget'
      )
    ),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  agent_id uuid unique references public.agents (id) on delete cascade,
  knowledge_source_ids uuid[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  primary key (workspace_id, request_id)
);

alter table private.agent_template_import_requests enable row level security;
revoke all on table private.agent_template_import_requests
  from public, anon, authenticated;
grant select, insert, update, delete
  on table private.agent_template_import_requests to service_role;

create or replace function private.resolve_agent_template_variables_v1(
  p_text text,
  p_values jsonb
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  resolved_text text := coalesce(p_text, '');
  normalized_values jsonb := coalesce(p_values, '{}'::jsonb);
  variable_count integer;
  variable_record record;
  replacement_text text;
begin
  if jsonb_typeof(normalized_values) <> 'object' then
    raise exception 'AGENT_TEMPLATE_INVALID'
      using errcode = '22023';
  end if;

  select count(*)
  into variable_count
  from jsonb_object_keys(normalized_values);

  if variable_count > 50 then
    raise exception 'AGENT_TEMPLATE_INVALID'
      using errcode = '22023';
  end if;

  for variable_record in
    select entries.key, entries.value
    from jsonb_each(normalized_values) as entries
  loop
    if variable_record.key !~ '^[a-z][a-z0-9_]{0,63}$'
      or jsonb_typeof(variable_record.value) <> 'string'
      or char_length(variable_record.value #>> '{}') > 2000 then
      raise exception 'AGENT_TEMPLATE_INVALID'
        using errcode = '22023';
    end if;

    -- regexp_replace treats backslashes specially in replacement strings.
    -- Doubling them preserves the exact user-provided variable value.
    replacement_text := replace(
      variable_record.value #>> '{}',
      E'\\',
      E'\\\\'
    );
    resolved_text := regexp_replace(
      resolved_text,
      '\{\{' || variable_record.key || '\}\}',
      replacement_text,
      'gi'
    );
  end loop;

  return resolved_text;
end;
$$;

revoke all on function private.resolve_agent_template_variables_v1(
  text,
  jsonb
) from public, anon, authenticated;
grant execute on function private.resolve_agent_template_variables_v1(
  text,
  jsonb
) to service_role;

create or replace function private.attach_template_knowledge_sources_v1(
  p_definition jsonb,
  p_source_ids uuid[],
  p_resolved_instructions text
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_set(
    jsonb_set(
      p_definition,
      '{nodes}',
      coalesce(
        (
          select jsonb_agg(
            case
              when jsonb_typeof(nodes.value) = 'object'
                and nodes.value #>> '{data,kind}' = 'knowledge'
              then jsonb_set(
                jsonb_set(
                  nodes.value,
                  '{data,sourceIds}',
                  to_jsonb(coalesce(p_source_ids, '{}'::uuid[])),
                  true
                ),
                '{data,folderIds}',
                '[]'::jsonb,
                true
              )
              else nodes.value
            end
            order by nodes.ordinality
          )
          from jsonb_array_elements(p_definition -> 'nodes')
            with ordinality as nodes(value, ordinality)
        ),
        '[]'::jsonb
      ),
      true
    ),
    '{config,instructions}',
    to_jsonb(p_resolved_instructions),
    true
  );
$$;

revoke all on function private.attach_template_knowledge_sources_v1(
  jsonb,
  uuid[],
  text
) from public, anon, authenticated;
grant execute on function private.attach_template_knowledge_sources_v1(
  jsonb,
  uuid[],
  text
) to service_role;

create or replace function public.import_agent_library_template_v1(
  p_request_id uuid,
  p_actor_id uuid,
  p_workspace_id uuid,
  p_identity_kind text,
  p_template_id uuid,
  p_template_updated_at timestamptz,
  p_variable_values jsonb default '{}'::jsonb,
  p_initial_definition jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  template_record public.agent_library_templates%rowtype;
  import_record private.agent_template_import_requests%rowtype;
  source_record public.agent_library_template_sources%rowtype;
  resolved_template_kind text;
  resolved_instructions text;
  source_fingerprint jsonb;
  request_hash text;
  creation_result jsonb;
  created_agent_id uuid;
  imported_source_id uuid;
  imported_source_ids uuid[] := '{}';
  imported_definition jsonb;
  actual_source_count integer;
  inserted_rows integer;
  was_replayed boolean;
  persisted_source_count integer;
  persisted_link_count integer;
begin
  if p_request_id is null
    or p_actor_id is null
    or p_workspace_id is null
    or p_identity_kind is null
    or p_template_id is null
    or p_template_updated_at is null
    or p_identity_kind not in (
      'website',
      'automation',
      'assistant',
      'legacy_widget'
    )
    or p_initial_definition is null
    or jsonb_typeof(p_initial_definition) <> 'object'
    or jsonb_typeof(p_initial_definition -> 'nodes')
      is distinct from 'array'
    or jsonb_typeof(p_initial_definition -> 'config')
      is distinct from 'object'
    or octet_length(p_initial_definition::text) > 1048576 then
    raise exception 'AGENT_TEMPLATE_INVALID'
      using errcode = '22023';
  end if;

  -- Hold the same authoritative tenant inputs as create_agent_v1 before doing
  -- any template or knowledge work.
  perform 1
  from public.workspaces
  where workspaces.id = p_workspace_id
  for share;

  if not found then
    raise exception 'AGENT_CREATE_UNAUTHORIZED'
      using errcode = '42501';
  end if;

  perform 1
  from public.workspace_members
  where workspace_members.workspace_id = p_workspace_id
    and workspace_members.user_id = p_actor_id
  for share;

  if not found then
    raise exception 'AGENT_CREATE_UNAUTHORIZED'
      using errcode = '42501';
  end if;

  select templates.*
  into template_record
  from public.agent_library_templates templates
  where templates.id = p_template_id
    and templates.status = 'approved'
  for share;

  if not found then
    raise exception 'AGENT_TEMPLATE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if template_record.updated_at is distinct from p_template_updated_at then
    raise exception 'AGENT_CREATION_IDEMPOTENCY_CONFLICT'
      using errcode = '23505';
  end if;

  resolved_template_kind := coalesce(
    template_record.kind,
    case template_record.surface
      when 'widget' then 'website'
      when 'automation' then 'automation'
      when 'assistant' then 'assistant'
    end
  );

  if resolved_template_kind is null
    or (
      p_identity_kind = 'legacy_widget'
      and resolved_template_kind <> 'website'
    )
    or (
      p_identity_kind <> 'legacy_widget'
      and p_identity_kind <> resolved_template_kind
    )
    or (
      resolved_template_kind = 'website'
      and template_record.surface <> 'widget'
    )
    or (
      resolved_template_kind = 'automation'
      and template_record.surface <> 'automation'
    )
    or (
      resolved_template_kind = 'assistant'
      and template_record.surface <> 'assistant'
    ) then
    raise exception 'AGENT_TEMPLATE_INVALID'
      using errcode = '22023';
  end if;

  -- Freeze template source rows while computing the request fingerprint and
  -- cloning them later in this transaction.
  perform 1
  from public.agent_library_template_sources sources
  where sources.template_id = p_template_id
  for share;

  select
    count(*)::integer,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', sources.id,
          'name', sources.source_name,
          'description', sources.source_description,
          'originalSourceType', sources.original_source_type,
          'contentSha256',
            encode(extensions.digest(sources.content_text, 'sha256'), 'hex')
        )
        order by sources.id
      ),
      '[]'::jsonb
    )
  into actual_source_count, source_fingerprint
  from public.agent_library_template_sources sources
  where sources.template_id = p_template_id;

  if actual_source_count <> template_record.knowledge_source_count
    or actual_source_count > 500
    or exists (
      select 1
      from public.agent_library_template_sources sources
      where sources.template_id = p_template_id
        and (
          btrim(sources.content_text) = ''
          or octet_length(sources.content_text) > 1048576
        )
    ) then
    raise exception 'AGENT_TEMPLATE_SOURCE_TOO_LARGE'
      using errcode = '22023';
  end if;

  resolved_instructions :=
    private.resolve_agent_template_variables_v1(
      template_record.instructions,
      p_variable_values
    );

  request_hash := encode(
    extensions.digest(
      jsonb_build_object(
        'intentVersion', 1,
        'workspaceId', p_workspace_id,
        'actorId', p_actor_id,
        'identityKind', p_identity_kind,
        'templateId', p_template_id,
        'templateUpdatedAt', template_record.updated_at,
        'name', template_record.name,
        'description', template_record.description,
        'model', template_record.model,
        'instructions', resolved_instructions,
        'starterPrompts', to_jsonb(template_record.starter_prompts),
        'timezone', template_record.timezone,
        'initialDefinition', p_initial_definition,
        'sources', source_fingerprint
      )::text,
      'sha256'
    ),
    'hex'
  );

  insert into private.agent_template_import_requests (
    workspace_id,
    request_id,
    actor_id,
    template_id,
    identity_kind,
    payload_hash
  )
  values (
    p_workspace_id,
    p_request_id,
    p_actor_id,
    p_template_id,
    p_identity_kind,
    request_hash
  )
  on conflict (workspace_id, request_id) do nothing;

  get diagnostics inserted_rows = row_count;
  was_replayed := inserted_rows = 0;

  select requests.*
  into import_record
  from private.agent_template_import_requests requests
  where requests.workspace_id = p_workspace_id
    and requests.request_id = p_request_id
  for update;

  if import_record.actor_id <> p_actor_id
    or import_record.template_id <> p_template_id
    or import_record.identity_kind <> p_identity_kind
    or import_record.payload_hash <> request_hash then
    raise exception 'AGENT_CREATION_IDEMPOTENCY_CONFLICT'
      using errcode = '23505';
  end if;

  creation_result := public.create_agent_v1(
    p_request_id => p_request_id,
    p_actor_id => p_actor_id,
    p_workspace_id => p_workspace_id,
    p_identity_kind => p_identity_kind,
    p_name => template_record.name,
    p_source => 'template',
    p_template_id => p_template_id,
    p_description => template_record.description,
    p_model => template_record.model,
    p_instructions => resolved_instructions,
    p_starter_prompts => template_record.starter_prompts,
    p_timezone => template_record.timezone,
    p_initial_definition => p_initial_definition
  );

  created_agent_id := (creation_result ->> 'agentId')::uuid;

  if was_replayed then
    imported_source_ids := import_record.knowledge_source_ids;

    if import_record.completed_at is null
      or import_record.agent_id is null
      or import_record.agent_id <> created_agent_id then
      raise exception 'AGENT_CREATION_PERSISTENCE_FAILED'
        using errcode = 'P0001';
    end if;

    select count(*)::integer
    into persisted_source_count
    from public.knowledge_sources sources
    where sources.id = any(imported_source_ids)
      and sources.workspace_id = p_workspace_id
      and sources.metadata ->> 'agentLibraryTemplateId'
        = p_template_id::text;

    select count(*)::integer
    into persisted_link_count
    from public.agent_knowledge_sources links
    where links.agent_id = created_agent_id
      and links.knowledge_source_id = any(imported_source_ids);

    if persisted_source_count <> cardinality(imported_source_ids)
      or persisted_link_count <> cardinality(imported_source_ids) then
      raise exception 'AGENT_CREATION_PERSISTENCE_FAILED'
        using errcode = 'P0001';
    end if;
  else
    for source_record in
      select sources.*
      from public.agent_library_template_sources sources
      where sources.template_id = p_template_id
      order by sources.id
    loop
      insert into public.knowledge_sources (
        workspace_id,
        created_by,
        name,
        description,
        source_type,
        raw_text,
        mime_type,
        file_size_bytes,
        status,
        metadata
      )
      values (
        p_workspace_id,
        p_actor_id,
        source_record.source_name,
        source_record.source_description,
        'text',
        source_record.content_text,
        'text/plain',
        0,
        'pending',
        jsonb_build_object(
          'agentLibraryTemplateId', p_template_id,
          'agentLibraryTemplateSourceId', source_record.id,
          'originalSourceType', source_record.original_source_type,
          'importedFromAgentLibrary', true
        )
      )
      returning id into imported_source_id;

      perform public.reserve_knowledge_source_storage(
        p_workspace_id,
        imported_source_id,
        octet_length(source_record.content_text)::bigint
      );

      imported_source_ids :=
        array_append(imported_source_ids, imported_source_id);
    end loop;

    if cardinality(imported_source_ids) > 0 then
      insert into public.agent_knowledge_sources (
        agent_id,
        knowledge_source_id
      )
      select created_agent_id, source_ids.source_id
      from unnest(imported_source_ids) as source_ids(source_id);
    end if;

    imported_definition :=
      private.attach_template_knowledge_sources_v1(
        p_initial_definition,
        imported_source_ids,
        resolved_instructions
      );

    update public.agent_drafts
    set
      definition = imported_definition,
      updated_by = p_actor_id
    where agent_id = created_agent_id
      and workspace_id = p_workspace_id;

    if not found then
      raise exception 'AGENT_CREATION_PERSISTENCE_FAILED'
        using errcode = 'P0001';
    end if;

    update private.agent_template_import_requests
    set
      agent_id = created_agent_id,
      knowledge_source_ids = imported_source_ids,
      completed_at = timezone('utc', now())
    where workspace_id = p_workspace_id
      and request_id = p_request_id;
  end if;

  return creation_result || jsonb_build_object(
    'knowledgeSourceIds', to_jsonb(imported_source_ids),
    'replayed', was_replayed
  );
end;
$$;

revoke all on function public.import_agent_library_template_v1(
  uuid,
  uuid,
  uuid,
  text,
  uuid,
  timestamptz,
  jsonb,
  jsonb
) from public, anon, authenticated;
grant execute on function public.import_agent_library_template_v1(
  uuid,
  uuid,
  uuid,
  text,
  uuid,
  timestamptz,
  jsonb,
  jsonb
) to service_role;
