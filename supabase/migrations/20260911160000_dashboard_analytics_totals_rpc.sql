-- Analytics overview totals were computed by transferring every matching
-- conversation row to Node 1000 at a time with no upper bound, then reducing
-- them in JavaScript to four numbers. The row transfer grows linearly with
-- conversation volume while the answer stays constant-size, so this moves the
-- aggregation into Postgres where it belongs.
--
-- Filter semantics mirror applySummaryRowFilters() in
-- src/lib/dashboard/analytics.ts exactly. p_search must arrive already escaped
-- and lowercased by escapeIlikePattern() so ILIKE behaviour is unchanged.

create or replace function public.dashboard_conversation_analytics_totals(
  p_workspace_id uuid,
  p_start timestamptz,
  p_live_cutoff timestamptz,
  p_widget_id uuid default null,
  p_agent_id uuid default null,
  p_search text default null,
  p_session_status text default null
)
returns table (
  conversation_count bigint,
  message_count bigint,
  lead_count bigint,
  active_widget_ids uuid[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    count(*)::bigint as conversation_count,
    coalesce(sum(s.message_count), 0)::bigint as message_count,
    coalesce(sum(s.lead_count), 0)::bigint as lead_count,
    coalesce(
      array_agg(distinct s.widget_id) filter (where s.widget_id is not null),
      '{}'::uuid[]
    ) as active_widget_ids
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
    );
$$;

comment on function public.dashboard_conversation_analytics_totals(
  uuid, timestamptz, timestamptz, uuid, uuid, text, text
) is
  'Workspace-scoped analytics overview totals. Replaces an unbounded paged row transfer; filters mirror applySummaryRowFilters() in the app.';

-- Called only by the service-role analytics path, same as the direct table
-- reads it replaces. security invoker means it never widens access.
revoke all on function public.dashboard_conversation_analytics_totals(
  uuid, timestamptz, timestamptz, uuid, uuid, text, text
) from public, anon, authenticated;

grant execute on function public.dashboard_conversation_analytics_totals(
  uuid, timestamptz, timestamptz, uuid, uuid, text, text
) to service_role;
