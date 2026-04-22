import { NextRequest, NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { PlanTier } from "@/lib/types/subscription";

/**
 * Plan tier → subscription limits mapping.
 * This is the single source of truth for what each plan provides.
 * Keep in sync with the billing page display values and architecture.md.
 */
const PLAN_LIMITS: Record<
  PlanTier,
  { messages_limit: number; agents_limit: number; integrations_enabled: boolean }
> = {
  free: { messages_limit: 50, agents_limit: 1, integrations_enabled: false },
  starter: { messages_limit: 500, agents_limit: 3, integrations_enabled: true },
  // agents_limit of 9999 represents "unlimited" since the column is an integer.
  premium: { messages_limit: 4000, agents_limit: 9999, integrations_enabled: true },
};

const VALID_PLANS = new Set<PlanTier>(["free", "starter", "premium"]);

/**
 * PATCH /api/admin/workspaces/[id]/plan
 *
 * Admin-only endpoint. Changes the subscription plan for a workspace.
 * Automatically applies the correct limits (messages, agents, integrations)
 * for the chosen plan tier.
 *
 * Does NOT interact with Stripe — this is a manual override for internal ops.
 * Does NOT reset messages_used — usage history is preserved across plan changes.
 *
 * Body: { plan_tier: "free" | "starter" | "premium" }
 * Returns: { subscription: { plan_tier, messages_limit, agents_limit, integrations_enabled } }
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
      { error: "plan_tier must be one of: free, starter, premium." },
      { status: 400 },
    );
  }

  const limits = PLAN_LIMITS[plan_tier as PlanTier];

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
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", workspaceId)
    .select("plan_tier, messages_limit, messages_used, agents_limit, integrations_enabled")
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

  return NextResponse.json({ subscription });
}
