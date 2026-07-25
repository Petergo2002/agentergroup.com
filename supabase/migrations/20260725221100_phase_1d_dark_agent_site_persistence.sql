-- Phase 1D: private Website Agent channel, branding draft, and opaque asset
-- persistence. No anonymous policy or public delivery state is introduced.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

alter table public.chat_threads
  drop constraint if exists chat_threads_source_check;

alter table public.chat_threads
  add constraint chat_threads_source_check
  check (source in ('preview', 'assistant', 'agent_site_preview'));

create table if not exists public.agent_channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  kind text not null check (kind in ('agent_site', 'chat_widget')),
  delivery_state text not null default 'disabled'
    check (delivery_state = 'disabled'),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (agent_id, kind),
  unique (id, workspace_id, agent_id),
  constraint agent_channels_agent_workspace_fkey
    foreign key (agent_id, workspace_id)
    references public.agents (id, workspace_id)
);

create table if not exists public.agent_site_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  storage_object_id uuid not null unique references storage.objects (id),
  asset_kind text not null check (asset_kind = 'logo'),
  mime_type text not null
    check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  size_bytes bigint not null check (size_bytes between 1 and 5242880),
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  unique (id, workspace_id, agent_id),
  constraint agent_site_assets_agent_workspace_fkey
    foreign key (agent_id, workspace_id)
    references public.agents (id, workspace_id)
);

create or replace function private.valid_agent_site_starter_prompts(
  p_prompts text[]
)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select
    cardinality(p_prompts) <= 4
    and not exists (
      select 1
      from unnest(p_prompts) as prompt(value)
      where char_length(btrim(prompt.value)) < 1
         or char_length(prompt.value) > 160
         or prompt.value ~ '[[:cntrl:]]'
    )
    and cardinality(p_prompts) = (
      select count(distinct lower(prompt.value))
      from unnest(p_prompts) as prompt(value)
    );
$$;

revoke all on function private.valid_agent_site_starter_prompts(text[])
  from public, anon, authenticated;
grant execute on function private.valid_agent_site_starter_prompts(text[])
  to service_role;

create table if not exists public.agent_site_drafts (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null unique,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  agent_id uuid not null unique references public.agents (id) on delete cascade,
  public_key text not null unique
    default 'ags_' || encode(gen_random_bytes(18), 'hex'),
  slug text not null unique,
  display_name text not null,
  logo_asset_id uuid,
  primary_color text not null default '#6750a4',
  secondary_color text not null default '#625b71',
  theme text not null default 'system',
  welcome_heading text not null default 'How can I help?',
  welcome_message text not null default 'Ask me anything.',
  starter_prompts text[] not null default '{}',
  locale text not null default 'en',
  human_contact_type text not null default 'none',
  human_contact_value text,
  human_contact_label text,
  revision bigint not null default 1 check (revision > 0),
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint agent_site_drafts_channel_identity_fkey
    foreign key (channel_id, workspace_id, agent_id)
    references public.agent_channels (id, workspace_id, agent_id)
    on delete cascade,
  constraint agent_site_drafts_agent_workspace_fkey
    foreign key (agent_id, workspace_id)
    references public.agents (id, workspace_id),
  constraint agent_site_drafts_logo_identity_fkey
    foreign key (logo_asset_id, workspace_id, agent_id)
    references public.agent_site_assets (id, workspace_id, agent_id),
  constraint agent_site_drafts_public_key_check
    check (public_key ~ '^ags_[0-9a-f]{36}$'),
  constraint agent_site_drafts_slug_check
    check (
      char_length(slug) between 3 and 63
      and slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'
      and slug not in (
        'admin',
        'api',
        'app',
        'auth',
        'dashboard',
        'login',
        'signup',
        'support',
        'www'
      )
    ),
  constraint agent_site_drafts_display_name_check
    check (
      char_length(btrim(display_name)) between 1 and 80
      and display_name !~ '[[:cntrl:]]'
    ),
  constraint agent_site_drafts_primary_color_check
    check (primary_color ~ '^#[0-9a-f]{6}$'),
  constraint agent_site_drafts_secondary_color_check
    check (secondary_color ~ '^#[0-9a-f]{6}$'),
  constraint agent_site_drafts_theme_check
    check (theme in ('light', 'dark', 'system')),
  constraint agent_site_drafts_welcome_heading_check
    check (
      char_length(btrim(welcome_heading)) between 1 and 120
      and welcome_heading !~ '[[:cntrl:]]'
    ),
  constraint agent_site_drafts_welcome_message_check
    check (
      char_length(btrim(welcome_message)) between 1 and 500
      and regexp_replace(
        welcome_message,
        E'[\n\r\t]',
        '',
        'g'
      ) !~ '[[:cntrl:]]'
    ),
  constraint agent_site_drafts_starter_prompts_check
    check (private.valid_agent_site_starter_prompts(starter_prompts)),
  constraint agent_site_drafts_locale_check
    check (locale in ('en', 'sv')),
  constraint agent_site_drafts_human_contact_check
    check (
      (
        human_contact_type = 'none'
        and human_contact_value is null
        and human_contact_label is null
      )
      or (
        human_contact_type = 'email'
        and char_length(human_contact_value) between 3 and 254
        and human_contact_value ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      )
      or (
        human_contact_type = 'phone'
        and human_contact_value ~ '^\+[1-9][0-9]{6,14}$'
      )
      or (
        human_contact_type = 'url'
        and char_length(human_contact_value) between 9 and 2048
        and human_contact_value ~ '^https://[^[:space:]]+$'
        and human_contact_value !~ '^https://[^/]*@'
      )
    ),
  constraint agent_site_drafts_human_contact_label_check
    check (
      human_contact_label is null
      or (
        char_length(btrim(human_contact_label)) between 1 and 60
        and human_contact_label !~ '[[:cntrl:]]'
      )
    )
);

create index if not exists agent_channels_workspace_updated_idx
  on public.agent_channels (workspace_id, updated_at desc);

create index if not exists agent_site_assets_workspace_agent_idx
  on public.agent_site_assets (workspace_id, agent_id, created_at desc);

create index if not exists agent_site_drafts_workspace_updated_idx
  on public.agent_site_drafts (workspace_id, updated_at desc);

drop trigger if exists agent_channels_set_updated_at
  on public.agent_channels;
create trigger agent_channels_set_updated_at
before update on public.agent_channels
for each row execute procedure public.set_updated_at();

drop trigger if exists agent_site_drafts_set_updated_at
  on public.agent_site_drafts;
create trigger agent_site_drafts_set_updated_at
before update on public.agent_site_drafts
for each row execute procedure public.set_updated_at();

create or replace function private.validate_website_agent_channel()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.agents
    where agents.id = new.agent_id
      and agents.workspace_id = new.workspace_id
      and agents.kind = 'website'
      and agents.surface = 'widget'
  ) then
    raise exception 'AGENT_CHANNEL_REQUIRES_WEBSITE_AGENT'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_website_agent_channel()
  from public, anon, authenticated, service_role;

drop trigger if exists agent_channels_validate_website_agent
  on public.agent_channels;
create trigger agent_channels_validate_website_agent
before insert or update of workspace_id, agent_id, kind
on public.agent_channels
for each row execute function private.validate_website_agent_channel();

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'agent-site-assets',
  'agent-site-assets',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.agent_channels enable row level security;
alter table public.agent_site_assets enable row level security;
alter table public.agent_site_drafts enable row level security;

revoke all on table public.agent_channels from anon;
revoke all on table public.agent_site_assets from anon;
revoke all on table public.agent_site_drafts from anon;

revoke insert, update, delete, truncate, references, trigger
  on table public.agent_channels from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.agent_site_assets from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on table public.agent_site_drafts from authenticated;

grant select on table public.agent_channels to authenticated;
grant select on table public.agent_site_assets to authenticated;
grant select on table public.agent_site_drafts to authenticated;

drop policy if exists "agent_channels_member_select"
  on public.agent_channels;
create policy "agent_channels_member_select"
on public.agent_channels for select
to authenticated
using (
  private.is_workspace_member(workspace_id)
  and private.can_view_agent(agent_id)
);

drop policy if exists "agent_site_assets_member_select"
  on public.agent_site_assets;
create policy "agent_site_assets_member_select"
on public.agent_site_assets for select
to authenticated
using (
  private.is_workspace_member(workspace_id)
  and private.can_view_agent(agent_id)
);

drop policy if exists "agent_site_drafts_member_select"
  on public.agent_site_drafts;
create policy "agent_site_drafts_member_select"
on public.agent_site_drafts for select
to authenticated
using (
  private.is_workspace_member(workspace_id)
  and private.can_view_agent(agent_id)
);

create or replace function public.update_agent_site_draft_v1(
  p_actor_id uuid,
  p_agent_id uuid,
  p_expected_revision bigint,
  p_patch jsonb
)
returns setof public.agent_site_drafts
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_draft public.agent_site_drafts%rowtype;
  updated_draft public.agent_site_drafts%rowtype;
  next_starter_prompts text[];
  next_contact_type text;
  next_contact_value text;
  next_contact_label text;
  logo_id uuid;
  target_workspace_id uuid;
begin
  if p_actor_id is null
    or p_agent_id is null
    or p_expected_revision is null
    or p_expected_revision < 1
    or p_patch is null
    or jsonb_typeof(p_patch) <> 'object'
    or p_patch = '{}'::jsonb
    or octet_length(p_patch::text) > 16384
    or exists (
      select 1
      from jsonb_object_keys(p_patch) as patch_key(value)
      where patch_key.value not in (
        'slug',
        'displayName',
        'logoAssetId',
        'primaryColor',
        'secondaryColor',
        'theme',
        'welcomeHeading',
        'welcomeMessage',
        'starterPrompts',
        'locale',
        'humanContactFallback'
      )
    ) then
    raise exception 'AGENT_SITE_INVALID_PATCH'
      using errcode = '22023';
  end if;

  select agents.workspace_id
  into target_workspace_id
  from public.agents
  where agents.id = p_agent_id;

  if target_workspace_id is null then
    raise exception 'AGENT_SITE_ACCESS_DENIED'
      using errcode = '42501';
  end if;

  perform 1
  from public.workspaces
  where workspaces.id = target_workspace_id
    and workspaces.website_agents_enabled
  for share;

  if not found then
    raise exception 'AGENT_SITE_ACCESS_DENIED'
      using errcode = '42501';
  end if;

  perform 1
  from public.workspace_members
  where workspace_members.workspace_id = target_workspace_id
    and workspace_members.user_id = p_actor_id
  for share;

  if not found then
    raise exception 'AGENT_SITE_ACCESS_DENIED'
      using errcode = '42501';
  end if;

  perform 1
  from public.agents
  where agents.id = p_agent_id
    and agents.workspace_id = target_workspace_id
    and agents.kind = 'website'
    and agents.surface = 'widget'
    and agents.archived_at is null
  for share;

  if not found then
    raise exception 'AGENT_SITE_ACCESS_DENIED'
      using errcode = '42501';
  end if;

  select drafts.*
  into target_draft
  from public.agent_site_drafts drafts
  where drafts.agent_id = p_agent_id
  for update;

  if not found then
    raise exception 'AGENT_SITE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if target_draft.revision <> p_expected_revision then
    raise exception 'AGENT_SITE_REVISION_CONFLICT'
      using errcode = '40001';
  end if;

  next_starter_prompts := target_draft.starter_prompts;
  if p_patch ? 'starterPrompts' then
    if jsonb_typeof(p_patch -> 'starterPrompts') <> 'array' then
      raise exception 'AGENT_SITE_INVALID_PATCH'
        using errcode = '22023';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_patch -> 'starterPrompts')
        as prompt(value)
      where jsonb_typeof(prompt.value) <> 'string'
    ) then
      raise exception 'AGENT_SITE_INVALID_PATCH'
        using errcode = '22023';
    end if;

    select coalesce(array_agg(prompt.value order by prompt.ordinality), '{}')
    into next_starter_prompts
    from jsonb_array_elements_text(p_patch -> 'starterPrompts')
      with ordinality as prompt(value, ordinality);
  end if;

  next_contact_type := target_draft.human_contact_type;
  next_contact_value := target_draft.human_contact_value;
  next_contact_label := target_draft.human_contact_label;
  if p_patch ? 'humanContactFallback' then
    if jsonb_typeof(p_patch -> 'humanContactFallback') <> 'object'
      or exists (
        select 1
        from jsonb_object_keys(p_patch -> 'humanContactFallback')
          as contact_key(value)
        where contact_key.value not in ('type', 'value', 'label')
      ) then
      raise exception 'AGENT_SITE_INVALID_PATCH'
        using errcode = '22023';
    end if;

    next_contact_type := p_patch #>> '{humanContactFallback,type}';
    next_contact_value := p_patch #>> '{humanContactFallback,value}';
    next_contact_label := p_patch #>> '{humanContactFallback,label}';

    if next_contact_type = 'none' then
      next_contact_value := null;
      next_contact_label := null;
    end if;
  end if;

  logo_id := target_draft.logo_asset_id;
  if p_patch ? 'logoAssetId' then
    logo_id := nullif(p_patch ->> 'logoAssetId', '')::uuid;
  end if;

  update public.agent_site_drafts
  set
    slug = case
      when p_patch ? 'slug' then p_patch ->> 'slug'
      else target_draft.slug
    end,
    display_name = case
      when p_patch ? 'displayName' then p_patch ->> 'displayName'
      else target_draft.display_name
    end,
    logo_asset_id = logo_id,
    primary_color = case
      when p_patch ? 'primaryColor' then p_patch ->> 'primaryColor'
      else target_draft.primary_color
    end,
    secondary_color = case
      when p_patch ? 'secondaryColor' then p_patch ->> 'secondaryColor'
      else target_draft.secondary_color
    end,
    theme = case
      when p_patch ? 'theme' then p_patch ->> 'theme'
      else target_draft.theme
    end,
    welcome_heading = case
      when p_patch ? 'welcomeHeading' then p_patch ->> 'welcomeHeading'
      else target_draft.welcome_heading
    end,
    welcome_message = case
      when p_patch ? 'welcomeMessage' then p_patch ->> 'welcomeMessage'
      else target_draft.welcome_message
    end,
    starter_prompts = next_starter_prompts,
    locale = case
      when p_patch ? 'locale' then p_patch ->> 'locale'
      else target_draft.locale
    end,
    human_contact_type = next_contact_type,
    human_contact_value = next_contact_value,
    human_contact_label = next_contact_label,
    revision = target_draft.revision + 1,
    updated_by = p_actor_id
  where id = target_draft.id
  returning * into updated_draft;

  return next updated_draft;
  return;
exception
  when unique_violation then
    raise exception 'AGENT_SITE_SLUG_TAKEN'
      using errcode = '23505';
  when invalid_text_representation
    or check_violation
    or foreign_key_violation
    or not_null_violation
    or string_data_right_truncation then
    raise exception 'AGENT_SITE_INVALID_PATCH'
      using errcode = '22023';
end;
$$;

revoke all on function public.update_agent_site_draft_v1(
  uuid,
  uuid,
  bigint,
  jsonb
) from public, anon, authenticated;
grant execute on function public.update_agent_site_draft_v1(
  uuid,
  uuid,
  bigint,
  jsonb
) to service_role;
