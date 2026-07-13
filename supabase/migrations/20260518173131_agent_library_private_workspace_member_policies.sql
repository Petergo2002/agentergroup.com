drop policy if exists "agent_library_templates_member_select" on public.agent_library_templates;
create policy "agent_library_templates_member_select"
on public.agent_library_templates for select
to authenticated
using (
  status = 'approved'
  or submitted_by = (select auth.uid())
  or private.is_workspace_member(source_workspace_id)
);

drop policy if exists "agent_library_templates_member_insert" on public.agent_library_templates;
create policy "agent_library_templates_member_insert"
on public.agent_library_templates for insert
to authenticated
with check (
  submitted_by = (select auth.uid())
  and status = 'pending'
  and private.is_workspace_member(source_workspace_id)
);

drop policy if exists "agent_library_template_sources_member_select" on public.agent_library_template_sources;
create policy "agent_library_template_sources_member_select"
on public.agent_library_template_sources for select
to authenticated
using (
  exists (
    select 1
    from public.agent_library_templates templates
    where templates.id = template_id
      and (
        templates.status = 'approved'
        or templates.submitted_by = (select auth.uid())
        or private.is_workspace_member(templates.source_workspace_id)
      )
  )
);

drop policy if exists "agent_library_template_sources_member_insert" on public.agent_library_template_sources;
create policy "agent_library_template_sources_member_insert"
on public.agent_library_template_sources for insert
to authenticated
with check (
  exists (
    select 1
    from public.agent_library_templates templates
    where templates.id = template_id
      and templates.status = 'pending'
      and templates.submitted_by = (select auth.uid())
      and private.is_workspace_member(templates.source_workspace_id)
  )
);
