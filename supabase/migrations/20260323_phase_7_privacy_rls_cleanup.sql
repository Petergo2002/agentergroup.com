drop policy if exists "widget_preview_drafts_member_select" on public.widget_preview_drafts;
create policy "widget_preview_drafts_member_select"
on public.widget_preview_drafts for select
using (public.is_workspace_member(workspace_id));

drop policy if exists "widget_preview_drafts_member_insert" on public.widget_preview_drafts;
create policy "widget_preview_drafts_member_insert"
on public.widget_preview_drafts for insert
with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());

drop policy if exists "widget_preview_drafts_member_update" on public.widget_preview_drafts;
create policy "widget_preview_drafts_member_update"
on public.widget_preview_drafts for update
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

drop policy if exists "widget_preview_drafts_member_delete" on public.widget_preview_drafts;
create policy "widget_preview_drafts_member_delete"
on public.widget_preview_drafts for delete
using (public.is_workspace_member(workspace_id));

drop policy if exists "legacy_widget_leads_no_access" on public.legacy_widget_leads;
create policy "legacy_widget_leads_no_access"
on public.legacy_widget_leads
as restrictive
for all
using (false)
with check (false);

drop policy if exists "legacy_widget_session_messages_no_access" on public.legacy_widget_session_messages;
create policy "legacy_widget_session_messages_no_access"
on public.legacy_widget_session_messages
as restrictive
for all
using (false)
with check (false);

drop policy if exists "legacy_widget_sessions_no_access" on public.legacy_widget_sessions;
create policy "legacy_widget_sessions_no_access"
on public.legacy_widget_sessions
as restrictive
for all
using (false)
with check (false);
