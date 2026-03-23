alter table if exists public.widget_sessions
  add column if not exists status text not null default 'active'
    check (status in ('active', 'completed')),
  add column if not exists ended_at timestamptz,
  add column if not exists end_reason text,
  add column if not exists last_user_message_at timestamptz,
  add column if not exists last_assistant_message_at timestamptz;
