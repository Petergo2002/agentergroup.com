-- Conversation analytics had overview totals but no time series, so the
-- conversations view could show counts but never "how is this trending".
-- Deriving a trend client-side from the paginated conversation list would be
-- wrong: that list is a page of at most 20 rows, not the filtered population.
--
-- This mirrors dashboard_conversation_analytics_totals exactly — same source
-- table, same filter semantics as applySummaryRowFilters() in
-- src/lib/dashboard/analytics.ts, same escaped/lowercased p_search contract —
-- and only changes the projection from four scalars to one row per day.
--
-- Days with no activity are returned as explicit zero rows via generate_series
-- so the chart does not silently close gaps and imply continuity that is not
-- in the data.

create or replace function public.dashboard_conversation_analytics_trend(
  p_workspace_id uuid,
  p_start timestamptz,
  p_live_cutoff timestamptz,
  p_widget_id uuid default null,
  p_agent_id uuid default null,
  p_search text default null,
  p_session_status text default null
)
returns table (
  bucket_date date,
  conversation_count bigint,
  message_count bigint,
  lead_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with days as (
    select generate_series(
      date_trunc('day', p_start at time zone 'UTC')::date,
      date_trunc('day', now() at time zone 'UTC')::date,
      interval '1 day'
    )::date as bucket_date
  ),
  matched as (
    select
      date_trunc('day', s.last_activity_at at time zone 'UTC')::date as bucket_date,
      s.message_count,
      s.lead_count
    from public.dashboard_conversation_summaries s
    where s.workspace_id = p_workspace_id
      and s.last_activity_at >= p_start
      and (p_widget_id is null or s.widget_id = p_widget_id)
      and (p_agent_id is null or s.active_agent_id = p_agent_id)
      and (
        p_session_status is null
        or (p_session_status = 'completed' and s.status = 'completed')
        or (p_session_status = 'live'
            and s.status = 'active'
            and s.last_activity_at > p_live_cutoff)
        or (p_session_status = 'idle'
            and s.status = 'active'
            and s.last_activity_at <= p_live_cutoff)
        or p_session_status not in ('completed', 'live', 'idle')
      )
      and (
        p_search is null
        or p_search = ''
        or s.search_text ilike '%' || p_search || '%'
      )
  )
  select
    d.bucket_date,
    count(m.bucket_date)::bigint as conversation_count,
    coalesce(sum(m.message_count), 0)::bigint as message_count,
    coalesce(sum(m.lead_count), 0)::bigint as lead_count
  from days d
  left join matched m on m.bucket_date = d.bucket_date
  group by d.bucket_date
  order by d.bucket_date;
$$;

comment on function public.dashboard_conversation_analytics_trend(
  uuid, timestamptz, timestamptz, uuid, uuid, text, text
) is
  'Workspace-scoped daily conversation trend. Filters mirror dashboard_conversation_analytics_totals and applySummaryRowFilters() in the app. Empty days are returned as zero rows.';

-- Same posture as the totals RPC: service-role only, security invoker, so it
-- never widens access beyond the analytics path that already reads this table.
revoke all on function public.dashboard_conversation_analytics_trend(
  uuid, timestamptz, timestamptz, uuid, uuid, text, text
) from public, anon, authenticated;

grant execute on function public.dashboard_conversation_analytics_trend(
  uuid, timestamptz, timestamptz, uuid, uuid, text, text
) to service_role;
