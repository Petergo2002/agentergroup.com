create index if not exists widget_sessions_widget_id_last_seen_at_idx
  on public.widget_sessions (widget_id, last_seen_at desc);

create index if not exists widget_sessions_active_agent_id_idx
  on public.widget_sessions (active_agent_id);

create index if not exists widget_sessions_active_widget_agent_id_idx
  on public.widget_sessions (active_widget_agent_id);

create index if not exists widget_sessions_source_last_seen_at_idx
  on public.widget_sessions (source, last_seen_at desc);

create index if not exists widget_session_messages_widget_id_created_at_idx
  on public.widget_session_messages (widget_id, created_at desc);

create index if not exists widget_session_messages_session_role_created_at_idx
  on public.widget_session_messages (widget_session_id, role, created_at);

create index if not exists widget_session_messages_session_public_created_at_idx
  on public.widget_session_messages (widget_session_id, created_at)
  where role in ('user', 'assistant');

create index if not exists widget_leads_widget_session_id_idx
  on public.widget_leads (widget_session_id);

create index if not exists widget_leads_widget_id_created_at_desc_idx
  on public.widget_leads (widget_id, created_at desc);

create index if not exists widgets_workspace_status_idx
  on public.widgets (workspace_id, status);
