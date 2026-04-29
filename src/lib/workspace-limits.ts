import type { PlanTier } from "@/lib/types/subscription";

export const WORKSPACE_LIMITS_BY_PLAN: Record<PlanTier, number> = {
  free: 1,
  starter: 1,
  premium: 5,
};

export function getWorkspaceLimitForPlan(plan: PlanTier | null | undefined) {
  return WORKSPACE_LIMITS_BY_PLAN[plan ?? "free"];
}

export function getOwnedWorkspaceCount(
  workspaces: Array<{ membership: { role: string } }> | null | undefined,
) {
  return (workspaces ?? []).filter((entry) => entry.membership.role === "owner")
    .length;
}

export function canCreateWorkspace(input: {
  plan: PlanTier | null | undefined;
  ownedWorkspaceCount: number;
}) {
  return input.ownedWorkspaceCount < getWorkspaceLimitForPlan(input.plan);
}
