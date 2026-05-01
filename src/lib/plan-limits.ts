import type { PlanTier } from "@/lib/types/subscription";

export interface WorkspacePlanLimits {
  messages_limit: number;
  agents_limit: number;
  integrations_enabled: boolean;
  storage_limit_bytes: number;
  team_member_limit: number;
}

export const PLAN_LIMITS: Record<PlanTier, WorkspacePlanLimits> = {
  free: {
    messages_limit: 50,
    agents_limit: 1,
    integrations_enabled: false,
    storage_limit_bytes: 10485760,
    team_member_limit: 0,
  },
  starter: {
    messages_limit: 500,
    agents_limit: 3,
    integrations_enabled: true,
    storage_limit_bytes: 26214400,
    team_member_limit: 2,
  },
  premium: {
    messages_limit: 4000,
    agents_limit: 9999,
    integrations_enabled: true,
    storage_limit_bytes: 52428800,
    team_member_limit: 10,
  },
};

export function getTeamMemberLimitForPlan(plan: PlanTier | null | undefined) {
  return PLAN_LIMITS[plan ?? "free"].team_member_limit;
}

function formatPlanName(plan: PlanTier | null | undefined) {
  const resolvedPlan = plan ?? "free";
  return resolvedPlan.charAt(0).toUpperCase() + resolvedPlan.slice(1);
}

export function buildTeamMemberLimitError(plan: PlanTier | null | undefined) {
  const limit = getTeamMemberLimitForPlan(plan);

  if (limit === 0) {
    return "Team invites are not available on the Free plan. Upgrade to Starter or Premium to add teammates.";
  }

  return `Your ${formatPlanName(plan)} plan allows up to ${limit} team member${
    limit === 1 ? "" : "s"
  }. Remove a member, revoke a pending invite, or upgrade to invite more teammates.`;
}
