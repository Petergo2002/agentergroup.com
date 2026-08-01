-- This RPC is intentionally available to authenticated workspace members.
-- Run it with caller privileges so the workspace RLS policies remain in force.
alter function public.get_agent_product_bootstrap_v1(uuid)
  security invoker;
