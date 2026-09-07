-- Milo is a product facade over the existing agent + Widget V2 architecture.
-- Keep the internal schema generic so the customer-facing name can evolve.

alter table public.workspaces
  add column if not exists product_experience text not null default 'classic',
  add column if not exists primary_customer_agent_id uuid,
  add column if not exists primary_widget_id uuid;

alter table public.workspaces
  drop constraint if exists workspaces_product_experience_check;

alter table public.workspaces
  add constraint workspaces_product_experience_check
  check (product_experience in ('classic', 'milo'));

alter table public.workspaces
  drop constraint if exists workspaces_primary_customer_agent_id_fkey,
  drop constraint if exists workspaces_primary_widget_id_fkey;

alter table public.workspaces
  add constraint workspaces_primary_customer_agent_id_fkey
    foreign key (primary_customer_agent_id)
    references public.agents(id)
    on delete set null,
  add constraint workspaces_primary_widget_id_fkey
    foreign key (primary_widget_id)
    references public.widgets(id)
    on delete set null;

create index if not exists workspaces_primary_customer_agent_idx
  on public.workspaces(primary_customer_agent_id)
  where primary_customer_agent_id is not null;

create index if not exists workspaces_primary_widget_idx
  on public.workspaces(primary_widget_id)
  where primary_widget_id is not null;

create schema if not exists private;
revoke all on schema private from public;

create or replace function private.validate_workspace_primary_resources()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.primary_customer_agent_id is not null and not exists (
    select 1
    from public.agents a
    where a.id = new.primary_customer_agent_id
      and a.workspace_id = new.id
      and a.surface = 'widget'
      and a.archived_at is null
  ) then
    raise exception 'MILO_PRIMARY_AGENT_INVALID' using errcode = '23514';
  end if;

  if new.primary_widget_id is not null and not exists (
    select 1
    from public.widgets w
    where w.id = new.primary_widget_id
      and w.workspace_id = new.id
  ) then
    raise exception 'MILO_PRIMARY_WIDGET_INVALID' using errcode = '23514';
  end if;

  if new.product_experience = 'milo' and (
    new.primary_customer_agent_id is null
    or new.primary_widget_id is null
    or not exists (
      select 1
      from public.widget_agents wa
      where wa.widget_id = new.primary_widget_id
        and wa.agent_id = new.primary_customer_agent_id
    )
  ) then
    raise exception 'MILO_PRIMARY_LINK_INVALID' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_workspace_primary_resources()
  from public, anon, authenticated, service_role;

drop trigger if exists workspaces_validate_primary_resources on public.workspaces;
create trigger workspaces_validate_primary_resources
before insert or update of product_experience, primary_customer_agent_id, primary_widget_id
on public.workspaces
for each row execute function private.validate_workspace_primary_resources();

-- Only opt in legacy workspaces whose public configuration has exactly one
-- compatible agent, one widget, and the one link joining those resources.
with eligible as (
  select
    ws.id as workspace_id,
    (array_agg(distinct a.id order by a.id))[1] as agent_id,
    (array_agg(distinct w.id order by w.id))[1] as widget_id
  from public.workspaces ws
  join public.agents a
    on a.workspace_id = ws.id
   and a.surface = 'widget'
   and a.archived_at is null
  join public.widgets w
    on w.workspace_id = ws.id
  join public.widget_agents wa
    on wa.widget_id = w.id
   and wa.agent_id = a.id
  where ws.product_experience = 'classic'
  group by ws.id
  having count(distinct a.id) = 1
     and count(distinct w.id) = 1
     and count(distinct wa.id) = 1
     and (select count(*) from public.agents ax where ax.workspace_id = ws.id and ax.surface = 'widget' and ax.archived_at is null) = 1
     and (select count(*) from public.widgets wx where wx.workspace_id = ws.id) = 1
)
update public.workspaces ws
set
  primary_customer_agent_id = eligible.agent_id,
  primary_widget_id = eligible.widget_id,
  product_experience = 'milo',
  updated_at = timezone('utc', now())
from eligible
where ws.id = eligible.workspace_id;

create or replace function public.provision_workspace_milo_v1(
  p_workspace_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  workspace_record public.workspaces%rowtype;
  agent_count bigint;
  widget_count bigint;
  selected_agent_id uuid;
  selected_widget_id uuid;
  created_agent jsonb;
  did_create_agent boolean := false;
  did_create_widget boolean := false;
  did_create_link boolean := false;
  affected_rows bigint := 0;
begin
  if p_workspace_id is null or p_actor_id is null then
    raise exception 'MILO_PROVISION_INVALID_REQUEST' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('milo-provision:' || p_workspace_id::text, 0)
  );

  select * into workspace_record
  from public.workspaces ws
  where ws.id = p_workspace_id
  for update;

  if not found or not exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = p_actor_id
      and wm.role in ('owner', 'admin')
  ) then
    raise exception 'MILO_PROVISION_UNAUTHORIZED' using errcode = '42501';
  end if;

  selected_agent_id := workspace_record.primary_customer_agent_id;
  selected_widget_id := workspace_record.primary_widget_id;

  if selected_agent_id is not null and not exists (
    select 1 from public.agents a
    where a.id = selected_agent_id and a.workspace_id = p_workspace_id
      and a.surface = 'widget' and a.archived_at is null
  ) then
    selected_agent_id := null;
  end if;

  if selected_widget_id is not null and not exists (
    select 1 from public.widgets w
    where w.id = selected_widget_id and w.workspace_id = p_workspace_id
  ) then
    selected_widget_id := null;
  end if;

  if selected_agent_id is null then
    select count(*), (array_agg(a.id order by a.id))[1]
      into agent_count, selected_agent_id
    from public.agents a
    where a.workspace_id = p_workspace_id
      and a.surface = 'widget'
      and a.archived_at is null;

    if agent_count > 1 then
      raise exception 'MILO_PROVISION_AMBIGUOUS_AGENTS' using errcode = 'P0001';
    end if;
  end if;

  if selected_widget_id is null then
    select count(*), (array_agg(w.id order by w.id))[1]
      into widget_count, selected_widget_id
    from public.widgets w
    where w.workspace_id = p_workspace_id;

    if widget_count > 1 then
      raise exception 'MILO_PROVISION_AMBIGUOUS_WIDGETS' using errcode = 'P0001';
    end if;
  end if;

  if selected_agent_id is null then
    created_agent := public.create_agent_v1(
      md5(p_workspace_id::text || ':milo-primary-agent')::uuid,
      p_actor_id,
      p_workspace_id,
      'legacy_widget',
      'Milo',
      'blank',
      null,
      'Your AI employee for customer questions, leads, and connected business tools.',
      'openai/gpt-5-mini',
      'You are Milo, the company AI employee. Be helpful, accurate, concise, and use verified workspace knowledge. Never invent business facts. Ask a clarifying question when needed.',
      array['What can you help me with?', 'Tell me about this business', 'I would like to get in touch'],
      'UTC',
      null
    );
    selected_agent_id := (created_agent ->> 'agentId')::uuid;
    did_create_agent := true;
  end if;

  if selected_widget_id is null then
    insert into public.widgets (
      workspace_id,
      name,
      slug,
      brand_name,
      description,
      home_title,
      home_subtitle
    ) values (
      p_workspace_id,
      'Website Chat',
      'website-chat-' || left(replace(p_workspace_id::text, '-', ''), 12),
      workspace_record.name,
      'Website chat powered by Milo.',
      'Hi, I''m Milo',
      'How can I help you today?'
    )
    returning id into selected_widget_id;
    did_create_widget := true;
  end if;

  if exists (
    select 1 from public.widget_agents wa
    where wa.widget_id = selected_widget_id
      and wa.agent_id <> selected_agent_id
  ) then
    raise exception 'MILO_PROVISION_AMBIGUOUS_WIDGET_AGENTS' using errcode = 'P0001';
  end if;

  insert into public.widget_agents (
    widget_id,
    agent_id,
    label,
    description,
    greeting,
    placeholder,
    quick_actions,
    show_quick_actions,
    contact_form_settings
  ) values (
    selected_widget_id,
    selected_agent_id,
    'Milo',
    'Your AI employee',
    'Hi! I''m Milo. How can I help you today?',
    'Ask Milo a question...',
    '[{"label":"What can you help me with?","prompt":"What can you help me with?","icon":null},{"label":"Tell me about this business","prompt":"Tell me about this business","icon":null},{"label":"I would like to get in touch","prompt":"I would like to get in touch","icon":null}]'::jsonb,
    true,
    '{"submitButtonText":"Send","successMessage":"Thanks! We''ll get back to you soon.","introText":"Leave your details and we''ll contact you."}'::jsonb
  )
  on conflict (widget_id, agent_id) do nothing;

  get diagnostics affected_rows = row_count;
  did_create_link := affected_rows > 0;

  update public.workspaces
  set
    primary_customer_agent_id = selected_agent_id,
    primary_widget_id = selected_widget_id,
    product_experience = 'milo',
    updated_at = timezone('utc', now())
  where id = p_workspace_id;

  return jsonb_build_object(
    'agentId', selected_agent_id,
    'widgetId', selected_widget_id,
    'created', did_create_agent or did_create_widget or did_create_link,
    'createdAgent', did_create_agent,
    'createdWidget', did_create_widget,
    'createdLink', did_create_link,
    'adopted', not (did_create_agent or did_create_widget)
  );
end;
$$;

revoke all on function public.provision_workspace_milo_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.provision_workspace_milo_v1(uuid, uuid)
  to service_role;

create or replace function private.enforce_milo_primary_invariants()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  relevant_workspace_id uuid;
  primary_agent_id uuid;
  primary_widget_id uuid;
  experience text;
begin
  if tg_table_name = 'agents' then
    relevant_workspace_id := coalesce(old.workspace_id, new.workspace_id);
  elsif tg_table_name = 'widgets' then
    relevant_workspace_id := coalesce(old.workspace_id, new.workspace_id);
  else
    select w.workspace_id into relevant_workspace_id
    from public.widgets w
    where w.id = coalesce(old.widget_id, new.widget_id);
  end if;

  select ws.product_experience, ws.primary_customer_agent_id, ws.primary_widget_id
    into experience, primary_agent_id, primary_widget_id
  from public.workspaces ws
  where ws.id = relevant_workspace_id;

  if experience <> 'milo' then
    return coalesce(new, old);
  end if;

  if tg_table_name = 'agents' then
    if tg_op = 'INSERT' and new.surface = 'widget' and new.archived_at is null then
      raise exception 'MILO_AGENT_ALREADY_EXISTS' using errcode = '23514';
    end if;
    if tg_op = 'UPDATE'
      and old.surface <> 'widget'
      and new.surface = 'widget'
      and new.archived_at is null
      and new.id <> primary_agent_id then
      raise exception 'MILO_AGENT_ALREADY_EXISTS' using errcode = '23514';
    end if;
    if old.id = primary_agent_id and (
      tg_op = 'DELETE'
      or new.archived_at is not null
      or new.workspace_id <> old.workspace_id
      or new.surface <> old.surface
    ) then
      raise exception 'MILO_PRIMARY_AGENT_PROTECTED' using errcode = '23514';
    end if;
  elsif tg_table_name = 'widgets' then
    if tg_op = 'INSERT' then
      raise exception 'MILO_PRIMARY_WIDGET_ALREADY_EXISTS' using errcode = '23514';
    end if;
    if old.id = primary_widget_id and (
      tg_op = 'DELETE' or new.workspace_id <> old.workspace_id
    ) then
      raise exception 'MILO_PRIMARY_WIDGET_PROTECTED' using errcode = '23514';
    end if;
  else
    if tg_op = 'INSERT'
      and new.widget_id = primary_widget_id
      and new.agent_id <> primary_agent_id then
      raise exception 'MILO_PRIMARY_LINK_PROTECTED' using errcode = '23514';
    end if;
    if tg_op <> 'INSERT'
      and old.widget_id = primary_widget_id
      and old.agent_id = primary_agent_id
      and (
        tg_op = 'DELETE'
        or new.widget_id <> old.widget_id
        or new.agent_id <> old.agent_id
      ) then
      raise exception 'MILO_PRIMARY_LINK_PROTECTED' using errcode = '23514';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function private.enforce_milo_primary_invariants()
  from public, anon, authenticated, service_role;

drop trigger if exists agents_enforce_milo_primary_invariants on public.agents;
create trigger agents_enforce_milo_primary_invariants
before insert or update of workspace_id, archived_at, surface or delete on public.agents
for each row execute function private.enforce_milo_primary_invariants();

drop trigger if exists widgets_enforce_milo_primary_invariants on public.widgets;
create trigger widgets_enforce_milo_primary_invariants
before insert or update of workspace_id or delete on public.widgets
for each row execute function private.enforce_milo_primary_invariants();

drop trigger if exists widget_agents_enforce_milo_primary_invariants on public.widget_agents;
create trigger widget_agents_enforce_milo_primary_invariants
before insert or update of widget_id, agent_id or delete on public.widget_agents
for each row execute function private.enforce_milo_primary_invariants();

comment on column public.workspaces.product_experience is
  'Customer product facade. Classic preserves inventories; milo exposes one primary customer agent and widget.';
comment on column public.workspaces.primary_customer_agent_id is
  'Workspace-owned customer agent resolved by the stable Milo route.';
comment on column public.workspaces.primary_widget_id is
  'Workspace-owned widget resolved by the stable Website Chat route.';

-- Operator audit for workspaces that still need an explicit migration choice:
-- select ws.id, ws.name,
--   count(distinct a.id) filter (where a.surface = 'widget' and a.archived_at is null) as customer_agents,
--   count(distinct w.id) as widgets,
--   count(distinct wa.id) as widget_links
-- from public.workspaces ws
-- left join public.agents a on a.workspace_id = ws.id
-- left join public.widgets w on w.workspace_id = ws.id
-- left join public.widget_agents wa on wa.widget_id = w.id
-- where ws.product_experience = 'classic'
-- group by ws.id, ws.name
-- order by ws.name;
