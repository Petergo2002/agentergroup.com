-- 1. Missing Index Fix
CREATE INDEX IF NOT EXISTS workspace_invites_invited_by_idx ON public.workspace_invites (invited_by);

-- 2. profiles: Consolidate SELECT policies and fix auth_rls_initplan
DROP POLICY IF EXISTS profiles_select_self ON public.profiles;
DROP POLICY IF EXISTS profiles_workspace_peer_select ON public.profiles;

CREATE POLICY profiles_select_combined ON public.profiles
FOR SELECT
TO public
USING (
  (id = (SELECT auth.uid()))
  OR
  EXISTS (
    SELECT 1
    FROM public.workspace_members my_membership
    JOIN public.workspace_members peer_membership
      ON peer_membership.workspace_id = my_membership.workspace_id
    WHERE my_membership.user_id = (SELECT auth.uid())
      AND peer_membership.user_id = profiles.id
  )
);

-- 3. agents: Consolidate DELETE policies and fix auth_rls_initplan
DROP POLICY IF EXISTS agents_member_delete ON public.agents;
DROP POLICY IF EXISTS agents_owner_delete ON public.agents;

CREATE POLICY agents_delete_combined ON public.agents
FOR DELETE
TO public
USING (
  can_edit_agent(id)
  OR
  EXISTS (
    SELECT 1
    FROM public.workspaces
    WHERE workspaces.id = agents.workspace_id
      AND workspaces.owner_id = (SELECT auth.uid())
  )
);

-- 4. workspace_invites: Consolidate SELECT policies and fix auth_rls_initplan
DROP POLICY IF EXISTS workspace_invites_member_select ON public.workspace_invites;
DROP POLICY IF EXISTS workspace_invites_target_select ON public.workspace_invites;

CREATE POLICY workspace_invites_select_combined ON public.workspace_invites
FOR SELECT
TO public
USING (
  is_workspace_member(workspace_id)
  OR
  (lower(email) = lower((SELECT auth.jwt() ->> 'email')))
);

-- 5. workspace_invites: Fix auth_rls_initplan for ADMIN policies
DROP POLICY IF EXISTS workspace_invites_admin_insert ON public.workspace_invites;
DROP POLICY IF EXISTS workspace_invites_admin_update ON public.workspace_invites;
DROP POLICY IF EXISTS workspace_invites_admin_delete ON public.workspace_invites;

CREATE POLICY workspace_invites_admin_insert ON public.workspace_invites
FOR INSERT
TO public
WITH CHECK (
  (invited_by = (SELECT auth.uid()))
  AND
  EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_members.workspace_id = workspace_invites.workspace_id
      AND workspace_members.user_id = (SELECT auth.uid())
      AND workspace_members.role = ANY (ARRAY['owner', 'admin'])
  )
);

CREATE POLICY workspace_invites_admin_update ON public.workspace_invites
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_members.workspace_id = workspace_invites.workspace_id
      AND workspace_members.user_id = (SELECT auth.uid())
      AND workspace_members.role = ANY (ARRAY['owner', 'admin'])
  )
);

CREATE POLICY workspace_invites_admin_delete ON public.workspace_invites
FOR DELETE
TO public
USING (
  EXISTS (
    SELECT 1
    FROM public.workspace_members
    WHERE workspace_members.workspace_id = workspace_invites.workspace_id
      AND workspace_members.user_id = (SELECT auth.uid())
      AND workspace_members.role = ANY (ARRAY['owner', 'admin'])
  )
);

-- 6. workspace_members: Fix auth_rls_initplan for admin_delete
DROP POLICY IF EXISTS workspace_members_admin_delete ON public.workspace_members;

CREATE POLICY workspace_members_admin_delete ON public.workspace_members
FOR DELETE
TO public
USING (
  (user_id = (SELECT auth.uid()))
  OR
  EXISTS (
    SELECT 1
    FROM public.workspace_members actor
    WHERE actor.workspace_id = workspace_members.workspace_id
      AND actor.user_id = (SELECT auth.uid())
      AND actor.role = ANY (ARRAY['owner', 'admin'])
  )
);
