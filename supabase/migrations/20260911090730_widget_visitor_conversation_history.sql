alter table public.widget_sessions
  add column if not exists visitor_token_hash text,
  add column if not exists conversation_title text,
  add column if not exists last_message_preview text;

alter table public.widget_sessions
  drop constraint if exists widget_sessions_visitor_token_hash_format;

alter table public.widget_sessions
  add constraint widget_sessions_visitor_token_hash_format
  check (
    visitor_token_hash is null
    or visitor_token_hash ~ '^[0-9a-f]{64}$'
  ) not valid;

alter table public.widget_sessions
  validate constraint widget_sessions_visitor_token_hash_format;

create index if not exists widget_sessions_visitor_history_idx
  on public.widget_sessions (widget_id, visitor_token_hash, last_seen_at desc, id desc)
  where visitor_token_hash is not null and source <> 'preview';

comment on column public.widget_sessions.visitor_token_hash is
  'SHA-256 capability hash binding an anonymous browser visitor to its widget conversations. The raw token is never stored.';

comment on column public.widget_sessions.conversation_title is
  'Short title derived from the first visitor message for the visitor-facing recent chat list.';

comment on column public.widget_sessions.last_message_preview is
  'Truncated latest visible message used by the visitor-facing recent chat list.';
