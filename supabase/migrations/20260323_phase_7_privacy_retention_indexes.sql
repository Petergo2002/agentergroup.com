create index if not exists widget_sessions_last_seen_at_idx
  on public.widget_sessions (last_seen_at);

create index if not exists widget_leads_created_at_idx
  on public.widget_leads (created_at);

create index if not exists widget_leads_lower_email_idx
  on public.widget_leads (lower(email));
