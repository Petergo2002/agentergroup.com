create index if not exists widget_sessions_widget_source_last_seen_id_idx
  on public.widget_sessions (widget_id, source, last_seen_at desc, id desc);

drop policy if exists "admin_update_workspace_subscriptions"
  on public.workspace_subscriptions;

create policy "admin_update_workspace_subscriptions"
on public.workspace_subscriptions for update
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.is_admin = true
  )
);
