revoke execute on function private.is_workspace_member(uuid) from public;
revoke execute on function private.workspace_internal_assistants_enabled(uuid) from public;
revoke execute on function private.can_edit_agent(uuid) from public;

grant execute on function private.is_workspace_member(uuid) to anon, authenticated, service_role;
grant execute on function private.workspace_internal_assistants_enabled(uuid) to anon, authenticated, service_role;
grant execute on function private.can_edit_agent(uuid) to anon, authenticated, service_role;
