import type { PlanTier } from "@/lib/types/subscription";

export interface WorkspacePlanLimits {
  messages_limit: number;
  agents_limit: number;
  integrations_enabled: boolean;
  storage_limit_bytes: number;
  team_member_limit: number;
}

/** How long a granted trial lasts before it stops allowing messages. */
export const TRIAL_DURATION_DAYS = 30;

export const PLAN_LIMITS: Record<PlanTier, WorkspacePlanLimits> = {
  free: {
    messages_limit: 50,
    agents_limit: 1,
    integrations_enabled: false,
    storage_limit_bytes: 10485760,
    team_member_limit: 0,
  },
  // Starter's capabilities on a 30-day clock: a trial that cannot use
  // integrations is not a trial of the product anyone would buy.
  trial: {
    messages_limit: 500,
    agents_limit: 3,
    integrations_enabled: true,
    storage_limit_bytes: 26214400,
    team_member_limit: 2,
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

/**
 * Plans that unlock the premium *capability* set, as opposed to premium limits.
 *
 * A trial exists so someone can see what they would be paying for, and the
 * capability that matters most there is indexing their actual website: a Milo
 * that only knows one page cannot demonstrate anything. The trial keeps its own
 * smaller allowances — 500 messages, 3 agents, 25MB — so the capability is
 * unlocked without the trial becoming a way to get Premium volume for free.
 */
export function hasPremiumCapabilities(plan: PlanTier | null | undefined) {
  return plan === "premium" || plan === "trial";
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
