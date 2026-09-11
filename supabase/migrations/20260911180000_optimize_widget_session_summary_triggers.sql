-- Migration: Optimize widget session summary triggers to eliminate write amplification and pg_cron spikes
-- Fast-paths presence heartbeats, turn-lock operations, and status transitions without expensive lateral joins

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

  if tg_op = 'INSERT' then
    perform private.refresh_dashboard_conversation_summary(new.id);
    return new;
  end if;

  -- Fast Path 1: Turn-lock acquires/releases and internal timestamp touches
  -- If structural fields and presence timestamps are unchanged, skip completely.
  if old.widget_id = new.widget_id
    and old.session_id = new.session_id
    and old.source = new.source
    and old.status = new.status
    and old.active_agent_id is not distinct from new.active_agent_id
    and old.active_widget_agent_id is not distinct from new.active_widget_agent_id
    and old.conversation_title is not distinct from new.conversation_title
    and old.last_seen_at = new.last_seen_at
    and old.page_url is not distinct from new.page_url
    and old.referrer is not distinct from new.referrer
  then
    return new;
  end if;

  -- Fast Path 2: Heartbeat / presence telemetry (only last_seen_at or page metadata changed)
  if old.widget_id = new.widget_id
    and old.session_id = new.session_id
    and old.source = new.source
    and old.status = new.status
    and old.active_agent_id is not distinct from new.active_agent_id
    and old.active_widget_agent_id is not distinct from new.active_widget_agent_id
    and old.conversation_title is not distinct from new.conversation_title
  then
    update public.dashboard_conversation_summaries
    set
      last_activity_at = new.last_seen_at,
      page_url = coalesce(new.page_url, dashboard_conversation_summaries.page_url),
      referrer = coalesce(new.referrer, dashboard_conversation_summaries.referrer),
      updated_at = timezone('utc'::text, now())
    where widget_session_id = new.id;

    if found then
      return new;
    end if;
  end if;

  -- Fast Path 3: Status transition (e.g. pg_cron close_stale_widget_sessions setting status = 'completed')
  -- Message counts, snippets, and leads were already aggregated and didn't change while idle.
  if old.widget_id = new.widget_id
    and old.session_id = new.session_id
    and old.source = new.source
    and old.status is distinct from new.status
    and old.active_agent_id is not distinct from new.active_agent_id
    and old.active_widget_agent_id is not distinct from new.active_widget_agent_id
    and old.conversation_title is not distinct from new.conversation_title
  then
    update public.dashboard_conversation_summaries
    set
      status = new.status,
      last_activity_at = coalesce(new.last_seen_at, dashboard_conversation_summaries.last_activity_at),
      updated_at = timezone('utc'::text, now())
    where widget_session_id = new.id;

    if found then
      return new;
    end if;
  end if;

  -- Full Path: Structural changes (agent change, title change, or missing summary record)
  perform private.refresh_dashboard_conversation_summary(new.id);
  return new;
end;
$$;
