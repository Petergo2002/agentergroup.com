create table public.lead_conversation_summaries (
  lead_id uuid primary key references public.widget_leads (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  widget_session_id uuid not null references public.widget_sessions (id) on delete cascade,
  status text not null default 'generating'
    check (status in ('generating', 'ready', 'insufficient', 'failed')),
  summary jsonb,
  model text,
  source_hash text,
  source_message_count integer not null default 0
    check (source_message_count >= 0),
  source_last_message_at timestamptz,
  generated_at timestamptz,
  error_message text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint lead_conversation_summaries_summary_object
    check (summary is null or jsonb_typeof(summary) = 'object')
);

create index lead_conversation_summaries_workspace_idx
on public.lead_conversation_summaries (workspace_id, updated_at desc);

create index lead_conversation_summaries_session_idx
on public.lead_conversation_summaries (widget_session_id);

drop trigger if exists lead_conversation_summaries_set_updated_at
on public.lead_conversation_summaries;

create trigger lead_conversation_summaries_set_updated_at
before update on public.lead_conversation_summaries
for each row execute procedure public.set_updated_at();

alter table public.lead_conversation_summaries enable row level security;

drop policy if exists "lead_conversation_summaries_member_select"
on public.lead_conversation_summaries;

create policy "lead_conversation_summaries_member_select"
on public.lead_conversation_summaries for select
to authenticated
using ((select private.is_workspace_member(workspace_id)));

revoke all on table public.lead_conversation_summaries from anon;
grant select on table public.lead_conversation_summaries to authenticated;
grant all on table public.lead_conversation_summaries to service_role;
