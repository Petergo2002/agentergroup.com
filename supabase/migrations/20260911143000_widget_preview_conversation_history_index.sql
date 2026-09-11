-- Builder previews now serve real conversation history instead of fabricated
-- sample rows, so preview sessions need the same bounded visitor lookup index
-- that live sessions already have.
create index if not exists widget_sessions_preview_visitor_history_idx
  on public.widget_sessions (widget_id, visitor_token_hash, last_seen_at desc, id desc)
  where visitor_token_hash is not null and source = 'preview';

comment on index public.widget_sessions_preview_visitor_history_idx is
  'Visitor-scoped lookup for builder preview conversation history, kept separate from live visitor history.';
