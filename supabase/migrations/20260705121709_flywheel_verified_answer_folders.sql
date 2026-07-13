alter table public.knowledge_folders
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists knowledge_folders_flywheel_verified_answers_agent_idx
  on public.knowledge_folders (workspace_id, ((metadata ->> 'agentId')))
  where metadata ->> 'system' = 'flywheel'
    and metadata ->> 'purpose' = 'verified_answers'
    and metadata ? 'agentId';

with fact_agents as (
  select distinct on (facts.workspace_id, facts.agent_id)
    facts.workspace_id,
    facts.agent_id,
    facts.created_by,
    agents.name as agent_name
  from public.verified_facts facts
  join public.agents agents
    on agents.id = facts.agent_id
   and agents.workspace_id = facts.workspace_id
  where facts.status = 'published'
    and facts.knowledge_source_id is not null
  order by facts.workspace_id, facts.agent_id, facts.created_at asc
),
folders_to_create as (
  select
    fact_agents.workspace_id,
    fact_agents.agent_id,
    fact_agents.created_by,
    case
      when exists (
        select 1
        from public.knowledge_folders existing
        where existing.workspace_id = fact_agents.workspace_id
          and existing.name = concat('Verified answers - ', fact_agents.agent_name)
          and not (
            existing.metadata @> jsonb_build_object(
              'system', 'flywheel',
              'purpose', 'verified_answers',
              'agentId', fact_agents.agent_id::text
            )
          )
      )
        then concat(
          'Verified answers - ',
          fact_agents.agent_name,
          ' (',
          left(fact_agents.agent_id::text, 8),
          ')'
        )
      else concat('Verified answers - ', fact_agents.agent_name)
    end as folder_name
  from fact_agents
  where not exists (
    select 1
    from public.knowledge_folders existing
    where existing.workspace_id = fact_agents.workspace_id
      and existing.metadata @> jsonb_build_object(
        'system', 'flywheel',
        'purpose', 'verified_answers',
        'agentId', fact_agents.agent_id::text
      )
  )
)
insert into public.knowledge_folders (
  workspace_id,
  created_by,
  name,
  description,
  metadata
)
select
  workspace_id,
  created_by,
  folder_name,
  'Auto-managed verified answers from the Questions queue.',
  jsonb_build_object(
    'system', 'flywheel',
    'purpose', 'verified_answers',
    'agentId', agent_id::text
  )
from folders_to_create
on conflict do nothing;

with verified_answer_sources as (
  select distinct
    facts.workspace_id,
    facts.agent_id,
    facts.knowledge_source_id
  from public.verified_facts facts
  join public.knowledge_sources sources
    on sources.id = facts.knowledge_source_id
   and sources.workspace_id = facts.workspace_id
  where facts.status = 'published'
    and facts.knowledge_source_id is not null
),
verified_answer_folders as (
  select
    folders.id as folder_id,
    folders.workspace_id,
    (folders.metadata ->> 'agentId')::uuid as agent_id
  from public.knowledge_folders folders
  where folders.metadata ->> 'system' = 'flywheel'
    and folders.metadata ->> 'purpose' = 'verified_answers'
    and folders.metadata ? 'agentId'
)
insert into public.knowledge_folder_sources (
  folder_id,
  knowledge_source_id
)
select
  folders.folder_id,
  sources.knowledge_source_id
from verified_answer_sources sources
join verified_answer_folders folders
  on folders.workspace_id = sources.workspace_id
 and folders.agent_id = sources.agent_id
on conflict (folder_id, knowledge_source_id) do nothing;

with verified_answer_folders as (
  select
    folders.id as folder_id,
    folders.workspace_id,
    (folders.metadata ->> 'agentId')::uuid as agent_id
  from public.knowledge_folders folders
  where folders.metadata ->> 'system' = 'flywheel'
    and folders.metadata ->> 'purpose' = 'verified_answers'
    and folders.metadata ? 'agentId'
)
insert into public.agent_knowledge_folders (
  agent_id,
  knowledge_folder_id
)
select distinct
  folders.agent_id,
  folders.folder_id
from verified_answer_folders folders
join public.verified_facts facts
  on facts.workspace_id = folders.workspace_id
 and facts.agent_id = folders.agent_id
where facts.status = 'published'
  and facts.knowledge_source_id is not null
on conflict (agent_id, knowledge_folder_id) do nothing;

delete from public.agent_knowledge_sources direct_links
using public.verified_facts facts,
  public.knowledge_sources sources,
  public.knowledge_folders folders,
  public.knowledge_folder_sources folder_sources,
  public.agent_knowledge_folders agent_folders
where facts.status = 'published'
  and facts.knowledge_source_id is not null
  and sources.id = facts.knowledge_source_id
  and sources.workspace_id = facts.workspace_id
  and sources.metadata ->> 'flywheel' = 'true'
  and folders.workspace_id = facts.workspace_id
  and folders.metadata ->> 'system' = 'flywheel'
  and folders.metadata ->> 'purpose' = 'verified_answers'
  and folders.metadata ->> 'agentId' = facts.agent_id::text
  and folder_sources.folder_id = folders.id
  and folder_sources.knowledge_source_id = facts.knowledge_source_id
  and agent_folders.agent_id = facts.agent_id
  and agent_folders.knowledge_folder_id = folders.id
  and direct_links.agent_id = facts.agent_id
  and direct_links.knowledge_source_id = facts.knowledge_source_id;
