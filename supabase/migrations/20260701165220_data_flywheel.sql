create table if not exists public.unanswered_queries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  widget_id uuid not null references public.widgets (id) on delete cascade,
  widget_agent_id uuid references public.widget_agents (id) on delete set null,
  agent_id uuid not null references public.agents (id) on delete cascade,
  widget_session_id uuid not null references public.widget_sessions (id) on delete cascade,
  user_message_id uuid references public.widget_session_messages (id) on delete set null,
  assistant_message_id uuid references public.widget_session_messages (id) on delete set null,
  question text not null,
  assistant_answer text not null default '',
  context_excerpt text not null default '',
  detection_reason text not null default '',
  confidence numeric(4, 3) not null default 0 check (confidence >= 0 and confidence <= 1),
  status text not null default 'open' check (status in ('open', 'answered', 'dismissed', 'duplicate')),
  duplicate_of uuid references public.unanswered_queries (id) on delete set null,
  dedupe_hash text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  resolved_at timestamptz,
  constraint unanswered_queries_duplicate_requires_parent check (
    (status = 'duplicate' and duplicate_of is not null)
    or (status <> 'duplicate')
  )
);

create table if not exists public.verified_facts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  unanswered_query_id uuid references public.unanswered_queries (id) on delete set null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  question text not null,
  answer text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'retired')),
  visibility text not null default 'agent_only' check (visibility in ('agent_only', 'public_ready')),
  knowledge_source_id uuid references public.knowledge_sources (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  published_at timestamptz,
  retired_at timestamptz,
  constraint verified_facts_published_requires_source check (
    status <> 'published'
    or knowledge_source_id is not null
  )
);

create index if not exists unanswered_queries_workspace_status_created_idx
  on public.unanswered_queries (workspace_id, status, created_at desc);

create index if not exists unanswered_queries_agent_status_idx
  on public.unanswered_queries (agent_id, status);

create index if not exists unanswered_queries_widget_session_idx
  on public.unanswered_queries (widget_session_id);

create unique index if not exists unanswered_queries_open_dedupe_idx
  on public.unanswered_queries (workspace_id, agent_id, dedupe_hash)
  where status = 'open' and duplicate_of is null;

create index if not exists unanswered_queries_duplicate_of_idx
  on public.unanswered_queries (duplicate_of)
  where duplicate_of is not null;

create index if not exists verified_facts_workspace_status_created_idx
  on public.verified_facts (workspace_id, status, created_at desc);

create index if not exists verified_facts_agent_status_idx
  on public.verified_facts (agent_id, status);

create index if not exists verified_facts_unanswered_query_idx
  on public.verified_facts (unanswered_query_id)
  where unanswered_query_id is not null;

create index if not exists verified_facts_knowledge_source_idx
  on public.verified_facts (knowledge_source_id)
  where knowledge_source_id is not null;

drop trigger if exists unanswered_queries_set_updated_at on public.unanswered_queries;
create trigger unanswered_queries_set_updated_at
before update on public.unanswered_queries
for each row execute procedure public.set_updated_at();

drop trigger if exists verified_facts_set_updated_at on public.verified_facts;
create trigger verified_facts_set_updated_at
before update on public.verified_facts
for each row execute procedure public.set_updated_at();

alter table public.unanswered_queries enable row level security;
alter table public.verified_facts enable row level security;

revoke all on table public.unanswered_queries from anon;
revoke all on table public.verified_facts from anon;

grant select, insert, update on table public.unanswered_queries to authenticated;
grant select, insert, update on table public.verified_facts to authenticated;
grant select, insert, update, delete on table public.unanswered_queries to service_role;
grant select, insert, update, delete on table public.verified_facts to service_role;

drop policy if exists "unanswered_queries_member_select"
on public.unanswered_queries;

create policy "unanswered_queries_member_select"
on public.unanswered_queries for select
to authenticated
using (private.is_workspace_member(workspace_id));

drop policy if exists "unanswered_queries_editor_insert"
on public.unanswered_queries;

create policy "unanswered_queries_editor_insert"
on public.unanswered_queries for insert
to authenticated
with check (
  private.is_workspace_member(workspace_id)
  and private.can_edit_agent(agent_id)
);

drop policy if exists "unanswered_queries_editor_update"
on public.unanswered_queries;

create policy "unanswered_queries_editor_update"
on public.unanswered_queries for update
to authenticated
using (
  private.is_workspace_member(workspace_id)
  and private.can_edit_agent(agent_id)
)
with check (
  private.is_workspace_member(workspace_id)
  and private.can_edit_agent(agent_id)
);

drop policy if exists "verified_facts_member_select"
on public.verified_facts;

create policy "verified_facts_member_select"
on public.verified_facts for select
to authenticated
using (private.is_workspace_member(workspace_id));

drop policy if exists "verified_facts_editor_insert"
on public.verified_facts;

create policy "verified_facts_editor_insert"
on public.verified_facts for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.is_workspace_member(workspace_id)
  and private.can_edit_agent(agent_id)
);

drop policy if exists "verified_facts_editor_update"
on public.verified_facts;

create policy "verified_facts_editor_update"
on public.verified_facts for update
to authenticated
using (
  private.is_workspace_member(workspace_id)
  and private.can_edit_agent(agent_id)
)
with check (
  private.is_workspace_member(workspace_id)
  and private.can_edit_agent(agent_id)
);
