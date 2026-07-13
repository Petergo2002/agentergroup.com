create index if not exists unanswered_queries_workspace_status_updated_idx
  on public.unanswered_queries (workspace_id, status, updated_at desc, created_at desc);
