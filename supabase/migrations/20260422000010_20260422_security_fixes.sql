-- Fix mutable search_path for SECURITY DEFINER functions
ALTER FUNCTION public.handle_new_workspace_subscription() SET search_path = public;
ALTER FUNCTION public.increment_workspace_message_usage(uuid) SET search_path = public;

-- Add explicit RLS policy for rate_limit_windows to satisfy linter
-- The table is already protected by REVOKE ALL, but the linter expects a policy if RLS is enabled.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'rate_limit_windows' AND policyname = 'Restricted access'
    ) THEN
        CREATE POLICY "Restricted access" ON public.rate_limit_windows
        FOR ALL
        TO postgres, service_role
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;
