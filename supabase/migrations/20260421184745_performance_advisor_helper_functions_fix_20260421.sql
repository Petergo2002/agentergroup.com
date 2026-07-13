CREATE OR REPLACE FUNCTION public.can_edit_agent(p_agent_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.agents
    left join public.workspace_members
      on workspace_members.workspace_id = agents.workspace_id
     and workspace_members.user_id = (select auth.uid())
    where agents.id = p_agent_id
      and (
        (
          agents.surface = 'widget'
          and workspace_members.user_id is not null
        )
        or (
          agents.surface = 'assistant'
          and public.workspace_internal_assistants_enabled(agents.workspace_id)
          and workspace_members.user_id is not null
          and (
            agents.created_by = (select auth.uid())
            or workspace_members.role in ('owner', 'admin')
          )
        )
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_workspace_member(target_workspace uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.workspace_members members
    where members.workspace_id = target_workspace
      and members.user_id = (select auth.uid())
  );
$function$;

-- Also double check the policy one more time to be absolutely sure about the subquery wrapping
DROP POLICY IF EXISTS workspace_invites_select_combined ON public.workspace_invites;
CREATE POLICY workspace_invites_select_combined ON public.workspace_invites
FOR SELECT
TO public
USING (
  is_workspace_member(workspace_id)
  OR
  (lower(email) = (SELECT lower(auth.jwt() ->> 'email')))
);
