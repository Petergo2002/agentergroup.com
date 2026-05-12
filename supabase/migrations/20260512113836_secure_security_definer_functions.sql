create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create or replace function private.is_workspace_member(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members members
    where members.workspace_id = target_workspace
      and members.user_id = (select auth.uid())
  );
$$;

create or replace function private.workspace_internal_assistants_enabled(target_workspace uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select workspaces.internal_assistants_enabled
      from public.workspaces
      where workspaces.id = target_workspace
    ),
    false
  );
$$;

create or replace function private.can_edit_agent(p_agent_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.agents
    left join public.workspace_members
      on workspace_members.workspace_id = agents.workspace_id
     and workspace_members.user_id = auth.uid()
    where agents.id = p_agent_id
      and (
        (
          agents.surface in ('widget', 'automation')
          and workspace_members.user_id is not null
        )
        or (
          agents.surface = 'assistant'
          and private.workspace_internal_assistants_enabled(agents.workspace_id)
          and workspace_members.user_id is not null
          and (
            agents.created_by = auth.uid()
            or workspace_members.role in ('owner', 'admin')
          )
        )
      )
  );
$$;

grant execute on function private.is_workspace_member(uuid) to anon, authenticated, service_role;
grant execute on function private.workspace_internal_assistants_enabled(uuid) to anon, authenticated, service_role;
grant execute on function private.can_edit_agent(uuid) to anon, authenticated, service_role;

do $$
declare
  policy_record record;
  using_expr text;
  check_expr text;
  statement text;
begin
  for policy_record in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname in ('public', 'storage')
      and (
        coalesce(qual, '') ilike '%is_workspace_member%'
        or coalesce(with_check, '') ilike '%is_workspace_member%'
        or coalesce(qual, '') ilike '%can_edit_agent%'
        or coalesce(with_check, '') ilike '%can_edit_agent%'
        or coalesce(qual, '') ilike '%workspace_internal_assistants_enabled%'
        or coalesce(with_check, '') ilike '%workspace_internal_assistants_enabled%'
      )
  loop
    using_expr := policy_record.qual;
    check_expr := policy_record.with_check;

    if using_expr is not null then
      using_expr := replace(using_expr, 'public.is_workspace_member(', '@@IS_WORKSPACE_MEMBER@@(');
      using_expr := replace(using_expr, 'is_workspace_member(', '@@IS_WORKSPACE_MEMBER@@(');
      using_expr := replace(using_expr, '@@IS_WORKSPACE_MEMBER@@(', 'private.is_workspace_member(');
      using_expr := replace(using_expr, 'public.can_edit_agent(', '@@CAN_EDIT_AGENT@@(');
      using_expr := replace(using_expr, 'can_edit_agent(', '@@CAN_EDIT_AGENT@@(');
      using_expr := replace(using_expr, '@@CAN_EDIT_AGENT@@(', 'private.can_edit_agent(');
      using_expr := replace(using_expr, 'public.workspace_internal_assistants_enabled(', '@@WORKSPACE_INTERNAL_ASSISTANTS_ENABLED@@(');
      using_expr := replace(using_expr, 'workspace_internal_assistants_enabled(', '@@WORKSPACE_INTERNAL_ASSISTANTS_ENABLED@@(');
      using_expr := replace(using_expr, '@@WORKSPACE_INTERNAL_ASSISTANTS_ENABLED@@(', 'private.workspace_internal_assistants_enabled(');
    end if;

    if check_expr is not null then
      check_expr := replace(check_expr, 'public.is_workspace_member(', '@@IS_WORKSPACE_MEMBER@@(');
      check_expr := replace(check_expr, 'is_workspace_member(', '@@IS_WORKSPACE_MEMBER@@(');
      check_expr := replace(check_expr, '@@IS_WORKSPACE_MEMBER@@(', 'private.is_workspace_member(');
      check_expr := replace(check_expr, 'public.can_edit_agent(', '@@CAN_EDIT_AGENT@@(');
      check_expr := replace(check_expr, 'can_edit_agent(', '@@CAN_EDIT_AGENT@@(');
      check_expr := replace(check_expr, '@@CAN_EDIT_AGENT@@(', 'private.can_edit_agent(');
      check_expr := replace(check_expr, 'public.workspace_internal_assistants_enabled(', '@@WORKSPACE_INTERNAL_ASSISTANTS_ENABLED@@(');
      check_expr := replace(check_expr, 'workspace_internal_assistants_enabled(', '@@WORKSPACE_INTERNAL_ASSISTANTS_ENABLED@@(');
      check_expr := replace(check_expr, '@@WORKSPACE_INTERNAL_ASSISTANTS_ENABLED@@(', 'private.workspace_internal_assistants_enabled(');
    end if;

    statement := format('alter policy %I on %I.%I', policy_record.policyname, policy_record.schemaname, policy_record.tablename);

    if using_expr is not null then
      statement := statement || format(' using (%s)', using_expr);
    end if;

    if check_expr is not null then
      statement := statement || format(' with check (%s)', check_expr);
    end if;

    execute statement;
  end loop;
end;
$$;

revoke execute on function public.acquire_chat_thread_turn_lock(uuid, text, timestamp with time zone, timestamp with time zone) from public, anon, authenticated;
revoke execute on function public.acquire_widget_session_turn_lock(uuid, text, text, timestamp with time zone, timestamp with time zone) from public, anon, authenticated;
revoke execute on function public.can_edit_agent(uuid) from public, anon, authenticated;
revoke execute on function public.cleanup_ephemeral_knowledge() from public, anon, authenticated;
revoke execute on function public.handle_new_workspace_subscription() from public, anon, authenticated;
revoke execute on function public.increment_workspace_message_usage(uuid) from public, anon, authenticated;
revoke execute on function public.is_workspace_member(uuid) from public, anon, authenticated;
revoke execute on function public.release_chat_thread_turn_lock(uuid, text) from public, anon, authenticated;
revoke execute on function public.release_widget_session_turn_lock(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.workspace_internal_assistants_enabled(uuid) from public, anon, authenticated;

grant execute on function public.acquire_chat_thread_turn_lock(uuid, text, timestamp with time zone, timestamp with time zone) to service_role;
grant execute on function public.acquire_widget_session_turn_lock(uuid, text, text, timestamp with time zone, timestamp with time zone) to service_role;
grant execute on function public.cleanup_ephemeral_knowledge() to service_role;
grant execute on function public.handle_new_workspace_subscription() to service_role;
grant execute on function public.increment_workspace_message_usage(uuid) to service_role;
grant execute on function public.release_chat_thread_turn_lock(uuid, text) to service_role;
grant execute on function public.release_widget_session_turn_lock(uuid, text, text) to service_role;
