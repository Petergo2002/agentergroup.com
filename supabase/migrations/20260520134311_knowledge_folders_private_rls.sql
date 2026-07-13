alter policy "knowledge_folders_member_select"
on public.knowledge_folders
using (private.is_workspace_member(workspace_id));

alter policy "knowledge_folders_member_insert"
on public.knowledge_folders
with check (
  private.is_workspace_member(workspace_id)
  and created_by = (select auth.uid())
);

alter policy "knowledge_folders_member_update"
on public.knowledge_folders
using (private.is_workspace_member(workspace_id))
with check (private.is_workspace_member(workspace_id));

alter policy "knowledge_folders_member_delete"
on public.knowledge_folders
using (private.is_workspace_member(workspace_id));

alter policy "knowledge_folder_sources_member_select"
on public.knowledge_folder_sources
using (
  exists (
    select 1
    from public.knowledge_folders folders
    where folders.id = folder_id
      and private.is_workspace_member(folders.workspace_id)
  )
);

alter policy "knowledge_folder_sources_member_insert"
on public.knowledge_folder_sources
with check (
  exists (
    select 1
    from public.knowledge_folders folders
    join public.knowledge_sources sources
      on sources.id = knowledge_source_id
    where folders.id = folder_id
      and folders.workspace_id = sources.workspace_id
      and private.is_workspace_member(folders.workspace_id)
  )
);

alter policy "knowledge_folder_sources_member_delete"
on public.knowledge_folder_sources
using (
  exists (
    select 1
    from public.knowledge_folders folders
    where folders.id = folder_id
      and private.is_workspace_member(folders.workspace_id)
  )
);

alter policy "agent_knowledge_folders_member_select"
on public.agent_knowledge_folders
using (
  exists (
    select 1
    from public.agents agents
    join public.knowledge_folders folders
      on folders.id = knowledge_folder_id
    where agents.id = agent_id
      and agents.workspace_id = folders.workspace_id
      and private.is_workspace_member(agents.workspace_id)
  )
);

alter policy "agent_knowledge_folders_member_insert"
on public.agent_knowledge_folders
with check (
  exists (
    select 1
    from public.agents agents
    join public.knowledge_folders folders
      on folders.id = knowledge_folder_id
    where agents.id = agent_id
      and agents.workspace_id = folders.workspace_id
      and private.is_workspace_member(agents.workspace_id)
  )
);

alter policy "agent_knowledge_folders_member_delete"
on public.agent_knowledge_folders
using (
  exists (
    select 1
    from public.agents agents
    where agents.id = agent_id
      and private.is_workspace_member(agents.workspace_id)
  )
);
