create index if not exists legacy_widget_deployments_published_version_id_idx
  on public.legacy_widget_deployments (published_version_id);

create index if not exists legacy_widget_leads_widget_session_id_idx
  on public.legacy_widget_leads (widget_session_id);

create index if not exists legacy_widget_session_messages_deployment_id_idx
  on public.legacy_widget_session_messages (deployment_id);

create index if not exists widget_agents_published_version_id_idx
  on public.widget_agents (published_version_id);

create index if not exists widget_leads_widget_agent_id_idx
  on public.widget_leads (widget_agent_id);

create index if not exists widget_leads_agent_id_idx
  on public.widget_leads (agent_id);

create index if not exists widget_preview_drafts_workspace_id_idx
  on public.widget_preview_drafts (workspace_id);

create index if not exists widget_preview_drafts_created_by_idx
  on public.widget_preview_drafts (created_by);

create index if not exists widget_session_messages_widget_agent_id_idx
  on public.widget_session_messages (widget_agent_id);

create index if not exists widget_session_messages_agent_id_idx
  on public.widget_session_messages (agent_id);

drop index if exists public.widget_leads_widget_id_idx;

drop policy if exists "widget_preview_drafts_member_insert" on public.widget_preview_drafts;
create policy "widget_preview_drafts_member_insert"
on public.widget_preview_drafts for insert
with check (public.is_workspace_member(workspace_id) and created_by = (select auth.uid()));
