-- 1. Widget Sessions: Add status index for quick filtering of active/ended sessions
CREATE INDEX IF NOT EXISTS widget_sessions_status_idx ON public.widget_sessions (status);

-- 2. Widget Sessions: Combined index for common dashboard filtering
CREATE INDEX IF NOT EXISTS widget_sessions_widget_status_first_seen_idx
ON public.widget_sessions (widget_id, status, first_seen_at DESC);

-- 3. Widget Session Messages: Optimize retrieval for specific roles (e.g., user vs assistant)
CREATE INDEX IF NOT EXISTS widget_session_messages_role_idx ON public.widget_session_messages (role);

-- 4. Knowledge Chunks: Add index on source_id for faster cleanup/sync
CREATE INDEX IF NOT EXISTS knowledge_chunks_source_id_idx ON public.knowledge_chunks (source_id);

-- 5. Rate Limits: Optimize lookup for active windows (Using scope_key)
CREATE INDEX IF NOT EXISTS rate_limit_windows_scope_key_expires_idx
ON public.rate_limit_windows (scope_key, expires_at DESC);

-- 6. Audit Logs: Combined index for better admin dashboard filtering
CREATE INDEX IF NOT EXISTS audit_logs_workspace_action_created_idx
ON public.audit_logs (workspace_id, action, created_at DESC);

-- 7. Agents: Index for workspace internal assistant lookups
CREATE INDEX IF NOT EXISTS agents_workspace_surface_idx ON public.agents (workspace_id, surface);
