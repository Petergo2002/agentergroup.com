create index if not exists unanswered_queries_widget_id_idx
  on public.unanswered_queries (widget_id);

create index if not exists unanswered_queries_widget_agent_id_idx
  on public.unanswered_queries (widget_agent_id)
  where widget_agent_id is not null;

create index if not exists unanswered_queries_user_message_id_idx
  on public.unanswered_queries (user_message_id)
  where user_message_id is not null;

create index if not exists unanswered_queries_assistant_message_id_idx
  on public.unanswered_queries (assistant_message_id)
  where assistant_message_id is not null;

create index if not exists verified_facts_created_by_idx
  on public.verified_facts (created_by);
