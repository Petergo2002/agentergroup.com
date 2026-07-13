-- Inline the logic to ensure no hidden auth calls are missed by the linter
DROP POLICY IF EXISTS workspace_invites_select_combined ON public.workspace_invites;

CREATE POLICY workspace_invites_select_combined ON public.workspace_invites
FOR SELECT
TO public
USING (
  (EXISTS (
    SELECT 1
    FROM public.workspace_members members
    WHERE members.workspace_id = workspace_invites.workspace_id
      AND members.user_id = (SELECT auth.uid())
  ))
  OR
  (lower(email) = (SELECT lower(auth.jwt() ->> 'email')))
);
