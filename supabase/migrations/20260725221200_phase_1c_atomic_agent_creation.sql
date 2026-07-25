-- Phase 1C: one service-owned, idempotent transaction for Agent + initial
-- draft creation. The temporary `legacy_widget` identity is accepted only by
-- this service-role RPC so non-cohort users keep a compatible atomic path.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to service_role;

create table if not exists private.agent_creation_requests (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  request_id uuid not null,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  intent_version integer not null check (intent_version = 1),
  identity_kind text not null
    check (
      identity_kind in (
        'website',
        'automation',
        'assistant',
        'legacy_widget'
      )
    ),
  source text not null check (source in ('blank', 'template')),
  template_id uuid,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  agent_id uuid unique references public.agents (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  primary key (workspace_id, request_id),
  constraint agent_creation_requests_source_template_check
    check (
      (source = 'blank' and template_id is null)
      or (source = 'template' and template_id is not null)
    )
);

alter table private.agent_creation_requests enable row level security;
revoke all on table private.agent_creation_requests
  from public, anon, authenticated;
grant select, insert, update, delete
  on table private.agent_creation_requests to service_role;

create or replace function private.build_initial_agent_definition_v1(
  p_identity_kind text,
  p_model text,
  p_instructions text,
  p_starter_prompts text[],
  p_timezone text
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'nodes',
    jsonb_build_array(
      jsonb_build_object(
        'id', 'trigger',
        'type', 'agentNode',
        'position', jsonb_build_object('x', 40, 'y', 150),
        'data', jsonb_build_object(
          'kind', 'trigger',
          'label', case
            when p_identity_kind = 'automation'
              then 'External Trigger'
            else 'Chat Message'
          end,
          'type', 'Trigger',
          'icon', case
            when p_identity_kind = 'automation' then 'mail'
            else 'chat'
          end,
          'description', case
            when p_identity_kind = 'automation'
              then 'Starts from a connected external app event.'
            else 'Runs when a person sends a chat message.'
          end,
          'status', 'idle',
          'locked', true,
          'triggerSource', case
            when p_identity_kind = 'automation'
              then 'gmail_new_message'
            else 'user_message'
          end,
          'provider', case
            when p_identity_kind = 'automation' then 'composio'
            else 'internal'
          end,
          'toolkitSlug', case
            when p_identity_kind = 'automation' then to_jsonb('gmail'::text)
            else 'null'::jsonb
          end,
          'triggerSlug', case
            when p_identity_kind = 'automation'
              then to_jsonb('GMAIL_NEW_GMAIL_MESSAGE'::text)
            else 'null'::jsonb
          end,
          'connectionId', 'null'::jsonb,
          'triggerConfig', case
            when p_identity_kind = 'automation'
              then jsonb_build_object(
                'interval', 15,
                'labelIds', 'INBOX',
                'query', '',
                'userId', 'me'
              )
            else '{}'::jsonb
          end
        )
      ),
      jsonb_build_object(
        'id', 'agent',
        'type', 'agentNode',
        'position', jsonb_build_object('x', 320, 'y', 150),
        'data', jsonb_build_object(
          'kind', 'agent',
          'label', case
            when p_identity_kind = 'automation'
              then 'Automation Logic'
            else 'Agent'
          end,
          'type', case
            when p_identity_kind = 'automation' then 'Decision'
            else 'Core'
          end,
          'icon', 'smart_toy',
          'description', case
            when p_identity_kind = 'automation'
              then 'Analyzes each event and decides which configured actions are required.'
            else 'Uses the selected model, instructions, and context.'
          end,
          'status', 'active',
          'showConfidence', true,
          'confidenceValue', 82,
          'automationMode', p_identity_kind = 'automation',
          'locked', true
        )
      )
    ),
    'edges',
    jsonb_build_array(
      jsonb_build_object(
        'id', 'e-trigger-agent',
        'source', 'trigger',
        'target', 'agent',
        'animated', true,
        'style', jsonb_build_object(
          'stroke', 'var(--color-primary)',
          'strokeWidth', 2
        )
      )
    ),
    'viewport', jsonb_build_object('x', 0, 'y', 0, 'zoom', 0.95),
    'config', jsonb_build_object(
      'model', p_model,
      'instructions', p_instructions,
      'starterPrompts', to_jsonb(p_starter_prompts),
      'timezone', p_timezone,
      'trigger', jsonb_build_object(
        'source', case
          when p_identity_kind = 'automation'
            then 'gmail_new_message'
          else 'user_message'
        end,
        'provider', case
          when p_identity_kind = 'automation' then 'composio'
          else 'internal'
        end,
        'toolkitSlug', case
          when p_identity_kind = 'automation' then to_jsonb('gmail'::text)
          else 'null'::jsonb
        end,
        'triggerSlug', case
          when p_identity_kind = 'automation'
            then to_jsonb('GMAIL_NEW_GMAIL_MESSAGE'::text)
          else 'null'::jsonb
        end,
        'triggerConfig', case
          when p_identity_kind = 'automation'
            then jsonb_build_object(
              'interval', 15,
              'labelIds', 'INBOX',
              'query', '',
              'userId', 'me'
            )
          else '{}'::jsonb
        end,
        'connectionId', 'null'::jsonb
      )
    )
  );
$$;

revoke all on function private.build_initial_agent_definition_v1(
  text,
  text,
  text,
  text[],
  text
) from public, anon, authenticated;
grant execute on function private.build_initial_agent_definition_v1(
  text,
  text,
  text,
  text[],
  text
) to service_role;

create or replace function private.enforce_agent_has_draft()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_agent_id uuid;
begin
  if tg_table_name = 'agents' then
    target_agent_id := new.id;
  elsif tg_op = 'DELETE' then
    target_agent_id := old.agent_id;
  else
    target_agent_id := old.agent_id;
  end if;

  if exists (
    select 1
    from public.agents
    where agents.id = target_agent_id
  ) and not exists (
    select 1
    from public.agent_drafts
    where agent_drafts.agent_id = target_agent_id
  ) then
    raise exception 'AGENT_DRAFT_REQUIRED'
      using errcode = '23514';
  end if;

  if tg_table_name = 'agent_drafts'
    and tg_op = 'UPDATE'
    and new.agent_id is distinct from old.agent_id
    and exists (
      select 1
      from public.agents
      where agents.id = new.agent_id
    )
    and not exists (
      select 1
      from public.agent_drafts
      where agent_drafts.agent_id = new.agent_id
    ) then
    raise exception 'AGENT_DRAFT_REQUIRED'
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_agent_has_draft()
  from public, anon, authenticated, service_role;

create or replace function public.create_agent_v1(
  p_request_id uuid,
  p_actor_id uuid,
  p_workspace_id uuid,
  p_identity_kind text,
  p_name text,
  p_source text default 'blank',
  p_template_id uuid default null,
  p_description text default '',
  p_model text default 'openai/gpt-5-mini',
  p_instructions text default '',
  p_starter_prompts text[] default '{}',
  p_timezone text default 'UTC',
  p_initial_definition jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_name text;
  normalized_description text;
  normalized_timezone text;
  normalized_model text;
  normalized_instructions text;
  normalized_definition jsonb;
  compatibility_surface text;
  canonical_kind text;
  base_slug text;
  created_agent_id uuid;
  created_agent_slug text;
  created_draft_id uuid;
  created_channel_id uuid;
  created_site_draft_id uuid;
  created_site_slug text;
  request_hash text;
  request_record private.agent_creation_requests%rowtype;
  access_record record;
begin
  normalized_name := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  normalized_description := btrim(coalesce(p_description, ''));
  normalized_timezone := btrim(coalesce(p_timezone, ''));
  normalized_model := btrim(coalesce(p_model, ''));
  normalized_instructions := btrim(coalesce(p_instructions, ''));

  if p_request_id is null
    or p_actor_id is null
    or p_workspace_id is null
    or p_identity_kind is null
    or p_identity_kind not in (
      'website',
      'automation',
      'assistant',
      'legacy_widget'
    )
    or p_source is null
    or p_source not in ('blank', 'template')
    or (p_source = 'blank' and p_template_id is not null)
    or (p_source = 'template' and p_template_id is null)
    or char_length(normalized_name) not between 1 and 100
    or normalized_name ~ '[[:cntrl:]]'
    or char_length(normalized_description) > 500
    or char_length(normalized_model) not between 1 and 200
    or char_length(normalized_instructions) > 20000
    or char_length(normalized_timezone) not between 1 and 100
    or cardinality(coalesce(p_starter_prompts, '{}')) > 8
    or exists (
      select 1
      from unnest(coalesce(p_starter_prompts, '{}')) as prompt(value)
      where prompt.value is null
         or char_length(btrim(prompt.value)) not between 1 and 200
         or prompt.value ~ '[[:cntrl:]]'
    ) then
    raise exception 'AGENT_CREATE_INVALID_REQUEST'
      using errcode = '22023';
  end if;

  -- Hold authoritative access inputs until the transaction commits so a
  -- concurrent membership removal, Product-access disable, or workspace
  -- deletion cannot race a successful create.
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

  if p_identity_kind = 'legacy_widget' then
    compatibility_surface := 'widget';
    canonical_kind := null;
  else
    select *
    into access_record
    from private.resolve_agent_create_access(
      p_workspace_id,
      p_actor_id,
      p_identity_kind
    );

    if not coalesce(access_record.allowed, false) then
      if access_record.reason = 'agent_kind_disabled' then
        raise exception 'AGENT_KIND_DISABLED'
          using errcode = '42501';
      end if;

      if access_record.reason = 'agent_kind_unknown' then
        raise exception 'AGENT_CREATE_INVALID_REQUEST'
          using errcode = '22023';
      end if;

      raise exception 'AGENT_CREATE_UNAUTHORIZED'
        using errcode = '42501';
    end if;

    canonical_kind := p_identity_kind;
    compatibility_surface := case p_identity_kind
      when 'website' then 'widget'
      when 'automation' then 'automation'
      when 'assistant' then 'assistant'
    end;
  end if;

  normalized_definition := coalesce(
    p_initial_definition,
    private.build_initial_agent_definition_v1(
      p_identity_kind,
      normalized_model,
      normalized_instructions,
      coalesce(p_starter_prompts, '{}'),
      normalized_timezone
    )
  );

  if jsonb_typeof(normalized_definition) <> 'object'
    or octet_length(normalized_definition::text) > 1048576 then
    raise exception 'AGENT_CREATE_INVALID_REQUEST'
      using errcode = '22023';
  end if;

  request_hash := encode(
    extensions.digest(
      jsonb_build_object(
        'intentVersion', 1,
        'workspaceId', p_workspace_id,
        'actorId', p_actor_id,
        'identityKind', p_identity_kind,
        'name', normalized_name,
        'source', p_source,
        'templateId', p_template_id,
        'description', normalized_description,
        'model', normalized_model,
        'instructions', normalized_instructions,
        'starterPrompts', to_jsonb(coalesce(p_starter_prompts, '{}')),
        'timezone', normalized_timezone,
        'initialDefinition', normalized_definition
      )::text,
      'sha256'
    ),
    'hex'
  );

  insert into private.agent_creation_requests (
    workspace_id,
    request_id,
    actor_id,
    intent_version,
    identity_kind,
    source,
    template_id,
    payload_hash
  )
  values (
    p_workspace_id,
    p_request_id,
    p_actor_id,
    1,
    p_identity_kind,
    p_source,
    p_template_id,
    request_hash
  )
  on conflict (workspace_id, request_id) do nothing;

  select requests.*
  into request_record
  from private.agent_creation_requests requests
  where requests.workspace_id = p_workspace_id
    and requests.request_id = p_request_id
  for update;

  if request_record.actor_id <> p_actor_id
    or request_record.payload_hash <> request_hash then
    raise exception 'AGENT_CREATION_IDEMPOTENCY_CONFLICT'
      using errcode = '23505';
  end if;

  if request_record.agent_id is not null then
    select
      agents.id,
      agents.slug,
      drafts.id,
      channels.id,
      sites.id
    into
      created_agent_id,
      created_agent_slug,
      created_draft_id,
      created_channel_id,
      created_site_draft_id
    from public.agents
    join public.agent_drafts drafts
      on drafts.agent_id = agents.id
    left join public.agent_channels channels
      on channels.agent_id = agents.id
     and channels.kind = 'agent_site'
    left join public.agent_site_drafts sites
      on sites.agent_id = agents.id
    where agents.id = request_record.agent_id
      and agents.workspace_id = p_workspace_id;

    if created_agent_id is null
      or created_draft_id is null
      or (
        p_identity_kind = 'website'
        and (
          created_channel_id is null
          or created_site_draft_id is null
        )
      ) then
      raise exception 'AGENT_CREATION_PERSISTENCE_FAILED'
        using errcode = 'P0001';
    end if;

    return jsonb_build_object(
      'agentId', created_agent_id,
      'workspaceId', p_workspace_id,
      'kind', canonical_kind,
      'surface', compatibility_surface,
      'compatibility', case
        when p_identity_kind = 'legacy_widget' then 'legacy_widget'
        else 'none'
      end,
      'slug', created_agent_slug,
      'draftId', created_draft_id,
      'channelId', created_channel_id,
      'siteDraftId', created_site_draft_id,
      'replayed', true
    );
  end if;

  base_slug := lower(
    regexp_replace(normalized_name, '[^a-zA-Z0-9]+', '-', 'g')
  );
  base_slug := trim(both '-' from base_slug);
  if base_slug = '' then
    base_slug := 'agent';
  end if;

  created_agent_slug :=
    left(base_slug, 72)
    || '-'
    || left(replace(p_request_id::text, '-', ''), 12);

  insert into public.agents (
    workspace_id,
    created_by,
    kind,
    surface,
    name,
    slug,
    description,
    status,
    model,
    instructions,
    starter_prompts,
    timezone
  )
  values (
    p_workspace_id,
    p_actor_id,
    canonical_kind,
    compatibility_surface,
    normalized_name,
    created_agent_slug,
    normalized_description,
    'draft',
    normalized_model,
    normalized_instructions,
    coalesce(p_starter_prompts, '{}'),
    normalized_timezone
  )
  returning id into created_agent_id;

  insert into public.agent_drafts (
    agent_id,
    workspace_id,
    definition,
    version,
    updated_by
  )
  values (
    created_agent_id,
    p_workspace_id,
    normalized_definition,
    1,
    p_actor_id
  )
  returning id into created_draft_id;

  if p_identity_kind = 'website' then
    insert into public.agent_channels (
      workspace_id,
      agent_id,
      kind,
      delivery_state,
      created_by
    )
    values (
      p_workspace_id,
      created_agent_id,
      'agent_site',
      'disabled',
      p_actor_id
    )
    returning id into created_channel_id;

    created_site_slug :=
      left(base_slug, 44)
      || '-'
      || left(replace(p_request_id::text, '-', ''), 12);

    insert into public.agent_site_drafts (
      channel_id,
      workspace_id,
      agent_id,
      slug,
      display_name,
      primary_color,
      secondary_color,
      theme,
      welcome_heading,
      welcome_message,
      starter_prompts,
      locale,
      human_contact_type,
      created_by,
      updated_by
    )
    values (
      created_channel_id,
      p_workspace_id,
      created_agent_id,
      created_site_slug,
      normalized_name,
      '#6750a4',
      '#625b71',
      'system',
      'How can I help?',
      'Ask me anything.',
      '{}',
      'en',
      'none',
      p_actor_id,
      p_actor_id
    )
    returning id into created_site_draft_id;
  end if;

  update private.agent_creation_requests
  set
    agent_id = created_agent_id,
    completed_at = timezone('utc', now())
  where workspace_id = p_workspace_id
    and request_id = p_request_id;

  return jsonb_build_object(
    'agentId', created_agent_id,
    'workspaceId', p_workspace_id,
    'kind', canonical_kind,
    'surface', compatibility_surface,
    'compatibility', case
      when p_identity_kind = 'legacy_widget' then 'legacy_widget'
      else 'none'
    end,
    'slug', created_agent_slug,
    'draftId', created_draft_id,
    'channelId', created_channel_id,
    'siteDraftId', created_site_draft_id,
    'replayed', false
  );
end;
$$;

revoke all on function public.create_agent_v1(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  text[],
  text,
  jsonb
) from public, anon, authenticated;
grant execute on function public.create_agent_v1(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  uuid,
  text,
  text,
  text,
  text[],
  text,
  jsonb
) to service_role;
