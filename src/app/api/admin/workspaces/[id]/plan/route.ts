import { NextRequest, NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin/auth";
import { PLAN_LIMITS, TRIAL_DURATION_DAYS } from "@/lib/plan-limits";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { PlanTier } from "@/lib/types/subscription";

const VALID_PLANS = new Set<PlanTier>(["free", "starter", "premium", "trial"]);

function addDays(from: Date, days: number) {
  const result = new Date(from);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * PATCH /api/admin/workspaces/[id]/plan
 *
 * Admin-only endpoint. Changes the subscription plan for a workspace and
 * activates a pending pilot workspace.
 * Automatically applies the correct limits (messages, agents, integrations)
 * for the chosen plan tier.
 *
 * Does NOT interact with Stripe — this is a manual override for internal ops.
 * Does NOT reset messages_used — usage history is preserved across plan
 * changes — except when granting a trial, which is a fresh allowance and
 * therefore starts at zero.
 *
 * Granting "trial" sets trial_ends_at 30 days out. The database refuses
 * messages past that date (see increment_workspace_message_usage), so the
 * trial ends on its own without a scheduled job. Moving a workspace to any
 * other plan clears trial_ends_at.
 *
 * Body: { plan_tier: "free" | "starter" | "premium" | "trial" }
 * Returns: { subscription, activation: { onboarding_completed } }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workspaceId } = await params;

  // Authenticate caller
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await isAdminUser(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Parse and validate the request body
  const body = await request.json().catch(() => ({}));
  const plan_tier = body.plan_tier as string | undefined;

  if (!plan_tier || !VALID_PLANS.has(plan_tier as PlanTier)) {
    return NextResponse.json(
      { error: "plan_tier must be one of: free, trial, starter, premium." },
      { status: 400 },
    );
  }

  const limits = PLAN_LIMITS[plan_tier as PlanTier];
  const isTrial = plan_tier === "trial";
  const now = new Date();

  // A trial is a fresh 30-day grant, so it starts from zero and its billing
  // cycle is the trial window rather than a calendar month. Any other plan
  // leaves usage history alone and drops the trial deadline.
  const trialFields = isTrial
    ? {
        messages_used: 0,
        trial_ends_at: addDays(now, TRIAL_DURATION_DAYS).toISOString(),
        billing_cycle_start: now.toISOString(),
        billing_cycle_end: addDays(now, TRIAL_DURATION_DAYS).toISOString(),
      }
    : { trial_ends_at: null };

  // Write the new plan and limits using the service-role admin client.
  // The admin client bypasses RLS so no additional DB policy is required.
  const admin = createAdminClient();
  const { data: subscription, error } = await admin
    .from("workspace_subscriptions")
    .update({
      plan_tier,
      messages_limit: limits.messages_limit,
      agents_limit: limits.agents_limit,
      integrations_enabled: limits.integrations_enabled,
      storage_limit_bytes: limits.storage_limit_bytes,
      ...trialFields,
      updated_at: now.toISOString(),
    })
    .eq("workspace_id", workspaceId)
    .select("plan_tier, messages_limit, messages_used, agents_limit, integrations_enabled, storage_limit_bytes, trial_ends_at, billing_cycle_end")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!subscription) {
    return NextResponse.json(
      { error: "Workspace subscription not found." },
      { status: 404 },
    );
  }

  // Plan limits must be stored before access is unlocked. This keeps pending
  // users behind onboarding if subscription assignment fails.
  const { data: activation, error: activationError } = await admin
    .from("workspaces")
    .update({ onboarding_completed: true })
    .eq("id", workspaceId)
    .select("onboarding_completed")
    .maybeSingle();

  if (activationError) {
    return NextResponse.json({ error: activationError.message }, { status: 500 });
  }

  if (!activation) {
    return NextResponse.json(
      { error: "Workspace not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({ subscription, activation });
}
