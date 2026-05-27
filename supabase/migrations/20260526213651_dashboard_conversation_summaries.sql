create extension if not exists pg_trgm with schema extensions;

create table if not exists public.dashboard_conversation_summaries (
  widget_session_id uuid primary key references public.widget_sessions (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  widget_id uuid not null references public.widgets (id) on delete cascade,
  session_id text not null,
  active_agent_id uuid references public.agents (id) on delete set null,
  active_widget_agent_id uuid references public.widget_agents (id) on delete set null,
  source text not null check (source in ('embedded', 'hosted')),
  status text not null check (status in ('active', 'completed')),
  first_seen_at timestamptz not null,
  last_activity_at timestamptz not null,
  message_count integer not null default 0 check (message_count >= 0),
  user_message_count integer not null default 0 check (user_message_count >= 0),
  assistant_message_count integer not null default 0 check (assistant_message_count >= 0),
  latest_snippet text,
  lead_count integer not null default 0 check (lead_count >= 0),
  lead_name text,
  lead_email text,
  lead_phone text,
  page_url text,
  referrer text,
  search_text text generated always as (
    lower(
      coalesce(widget_session_id::text, '') || ' ' ||
      coalesce(session_id, '') || ' ' ||
      coalesce(widget_id::text, '') || ' ' ||
      coalesce(active_agent_id::text, '') || ' ' ||
      coalesce(active_widget_agent_id::text, '') || ' ' ||
      coalesce(latest_snippet, '') || ' ' ||
      coalesce(lead_name, '') || ' ' ||
      coalesce(lead_email, '') || ' ' ||
      coalesce(lead_phone, '') || ' ' ||
      coalesce(page_url, '') || ' ' ||
      coalesce(referrer, '')
    )
  ) stored,
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.dashboard_conversation_summaries enable row level security;

drop policy if exists "dashboard_conversation_summaries_member_select"
on public.dashboard_conversation_summaries;

create policy "dashboard_conversation_summaries_member_select"
on public.dashboard_conversation_summaries for select
using (private.is_workspace_member(workspace_id));

create index if not exists dashboard_conversation_summaries_workspace_activity_idx
on public.dashboard_conversation_summaries
(workspace_id, last_activity_at desc, widget_session_id desc);

create index if not exists dashboard_conversation_summaries_workspace_widget_activity_idx
on public.dashboard_conversation_summaries
(workspace_id, widget_id, last_activity_at desc);

create index if not exists dashboard_conversation_summaries_workspace_agent_activity_idx
on public.dashboard_conversation_summaries
(workspace_id, active_agent_id, last_activity_at desc);

create index if not exists dashboard_conversation_summaries_workspace_status_activity_idx
on public.dashboard_conversation_summaries
(workspace_id, status, last_activity_at desc);

create index if not exists dashboard_conversation_summaries_search_text_idx
on public.dashboard_conversation_summaries
using gin (search_text gin_trgm_ops);

create or replace function private.refresh_dashboard_conversation_summary(
  target_widget_session_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, private, extensions
as $$
begin
  if target_widget_session_id is null then
    return;
  end if;

  insert into public.dashboard_conversation_summaries (
    widget_session_id,
    workspace_id,
    widget_id,
    session_id,
    active_agent_id,
    active_widget_agent_id,
    source,
    status,
    first_seen_at,
    last_activity_at,
    message_count,
    user_message_count,
    assistant_message_count,
    latest_snippet,
    lead_count,
    lead_name,
    lead_email,
    lead_phone,
    page_url,
    referrer,
    updated_at
  )
  select
    sessions.id,
    widgets.workspace_id,
    sessions.widget_id,
    sessions.session_id,
    sessions.active_agent_id,
    sessions.active_widget_agent_id,
    sessions.source,
    sessions.status,
    sessions.first_seen_at,
    sessions.last_seen_at,
    coalesce(messages.message_count, 0)::integer,
    coalesce(messages.user_message_count, 0)::integer,
    coalesce(messages.assistant_message_count, 0)::integer,
    messages.latest_snippet,
    coalesce(leads.lead_count, 0)::integer,
    leads.lead_name,
    leads.lead_email,
    leads.lead_phone,
    sessions.page_url,
    sessions.referrer,
    timezone('utc'::text, now())
  from public.widget_sessions as sessions
  join public.widgets as widgets
    on widgets.id = sessions.widget_id
  left join lateral (
    select
      count(*) filter (where message.role in ('user', 'assistant')) as message_count,
      count(*) filter (where message.role = 'user') as user_message_count,
      count(*) filter (where message.role = 'assistant') as assistant_message_count,
      (
        array_agg(
          nullif(
            left(regexp_replace(message.content, '\s+', ' ', 'g'), 120),
            ''
          )
          order by message.created_at desc, message.id desc
        ) filter (where message.role in ('user', 'assistant'))
      )[1] as latest_snippet
    from public.widget_session_messages as message
    where message.widget_session_id = sessions.id
  ) as messages on true
  left join lateral (
    select
      count(*) as lead_count,
      (array_agg(lead.name order by lead.created_at desc, lead.id desc))[1] as lead_name,
      (array_agg(lead.email order by lead.created_at desc, lead.id desc))[1] as lead_email,
      (array_agg(lead.phone order by lead.created_at desc, lead.id desc))[1] as lead_phone
    from public.widget_leads as lead
    where lead.widget_session_id = sessions.id
  ) as leads on true
  where sessions.id = target_widget_session_id
    and sessions.source in ('embedded', 'hosted')
  on conflict (widget_session_id) do update set
    workspace_id = excluded.workspace_id,
    widget_id = excluded.widget_id,
    session_id = excluded.session_id,
    active_agent_id = excluded.active_agent_id,
    active_widget_agent_id = excluded.active_widget_agent_id,
    source = excluded.source,
    status = excluded.status,
    first_seen_at = excluded.first_seen_at,
    last_activity_at = excluded.last_activity_at,
    message_count = excluded.message_count,
    user_message_count = excluded.user_message_count,
    assistant_message_count = excluded.assistant_message_count,
    latest_snippet = excluded.latest_snippet,
    lead_count = excluded.lead_count,
    lead_name = excluded.lead_name,
    lead_email = excluded.lead_email,
    lead_phone = excluded.lead_phone,
    page_url = excluded.page_url,
    referrer = excluded.referrer,
    updated_at = excluded.updated_at;

  if not found then
    delete from public.dashboard_conversation_summaries
    where widget_session_id = target_widget_session_id;
  end if;
end;
$$;

create or replace function private.refresh_dashboard_conversation_summary_from_session()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.dashboard_conversation_summaries
    where widget_session_id = old.id;
    return old;
  end if;

  perform private.refresh_dashboard_conversation_summary(new.id);
  return new;
end;
$$;

create or replace function private.refresh_dashboard_conversation_summary_from_message()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if tg_op = 'DELETE' then
    perform private.refresh_dashboard_conversation_summary(old.widget_session_id);
    return old;
  end if;

  if tg_op = 'UPDATE'
    and old.widget_session_id is distinct from new.widget_session_id
  then
    perform private.refresh_dashboard_conversation_summary(old.widget_session_id);
  end if;

  perform private.refresh_dashboard_conversation_summary(new.widget_session_id);
  return new;
end;
$$;

create or replace function private.refresh_dashboard_conversation_summary_from_lead()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if tg_op = 'DELETE' then
    perform private.refresh_dashboard_conversation_summary(old.widget_session_id);
    return old;
  end if;

  if tg_op = 'UPDATE'
    and old.widget_session_id is distinct from new.widget_session_id
  then
    perform private.refresh_dashboard_conversation_summary(old.widget_session_id);
  end if;

  perform private.refresh_dashboard_conversation_summary(new.widget_session_id);
  return new;
end;
$$;

drop trigger if exists refresh_dashboard_conversation_summary_on_session
on public.widget_sessions;
create trigger refresh_dashboard_conversation_summary_on_session
after insert or update or delete on public.widget_sessions
for each row
execute function private.refresh_dashboard_conversation_summary_from_session();

drop trigger if exists refresh_dashboard_conversation_summary_on_message
on public.widget_session_messages;
create trigger refresh_dashboard_conversation_summary_on_message
after insert or update or delete on public.widget_session_messages
for each row
execute function private.refresh_dashboard_conversation_summary_from_message();

drop trigger if exists refresh_dashboard_conversation_summary_on_lead
on public.widget_leads;
create trigger refresh_dashboard_conversation_summary_on_lead
after insert or update or delete on public.widget_leads
for each row
execute function private.refresh_dashboard_conversation_summary_from_lead();

select private.refresh_dashboard_conversation_summary(id)
from public.widget_sessions
where source in ('embedded', 'hosted');

analyze public.dashboard_conversation_summaries;
