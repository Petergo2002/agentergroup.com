create index if not exists runs_workspace_status_created_idx
on public.runs (workspace_id, status, created_at desc);

create index if not exists connections_workspace_status_idx
on public.connections (workspace_id, status);

create index if not exists connections_workspace_display_name_idx
on public.connections (workspace_id, display_name);

create index if not exists agents_workspace_active_updated_idx
on public.agents (workspace_id, updated_at desc)
where archived_at is null;

create index if not exists widget_leads_session_created_idx
on public.widget_leads (widget_session_id, created_at desc);

create index if not exists widget_sessions_widget_source_status_last_seen_id_idx
on public.widget_sessions (widget_id, source, status, last_seen_at desc, id desc);
