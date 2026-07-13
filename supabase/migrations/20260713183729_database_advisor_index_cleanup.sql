-- Foreign-key columns are not indexed automatically by Postgres. Add a
-- leading-column index for each advisor-reported gap so joins and referenced
-- row deletes/updates do not require full scans of the referencing table.

create index if not exists agent_automations_connection_id_idx
  on public.agent_automations (connection_id);

create index if not exists agent_library_template_sources_original_source_id_idx
  on public.agent_library_template_sources (original_source_id);

create index if not exists agent_library_templates_reviewed_by_idx
  on public.agent_library_templates (reviewed_by);

create index if not exists agent_library_templates_source_agent_id_idx
  on public.agent_library_templates (source_agent_id);

create index if not exists agent_library_templates_source_workspace_id_idx
  on public.agent_library_templates (source_workspace_id);

create index if not exists automation_events_run_id_idx
  on public.automation_events (run_id);

create index if not exists connection_auth_links_completed_connection_id_idx
  on public.connection_auth_links (completed_connection_id);

create index if not exists connection_auth_links_created_by_idx
  on public.connection_auth_links (created_by);

create index if not exists dashboard_conversation_summaries_active_agent_id_idx
  on public.dashboard_conversation_summaries (active_agent_id);

create index if not exists dashboard_conversation_summaries_active_widget_agent_id_idx
  on public.dashboard_conversation_summaries (active_widget_agent_id);

create index if not exists dashboard_conversation_summaries_widget_id_idx
  on public.dashboard_conversation_summaries (widget_id);

create index if not exists knowledge_folders_created_by_idx
  on public.knowledge_folders (created_by);

create index if not exists widget_attachments_widget_id_idx
  on public.widget_attachments (widget_id);

-- Both indexes have the same key and predicate. Keep the later descriptive
-- repository name and remove the earlier production-only duplicate.
drop index if exists public.idx_knowledge_sources_widget_session_id;
