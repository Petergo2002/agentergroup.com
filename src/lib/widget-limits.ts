import type { PlanTier } from "@/lib/types/subscription";

export const WIDGET_LIMITS_BY_PLAN: Record<PlanTier, number> = {
  free: 1,
  trial: 3,
  starter: 3,
  premium: 6,
};

export function getWidgetLimitForPlan(plan: PlanTier | null | undefined) {
  return WIDGET_LIMITS_BY_PLAN[plan ?? "free"];
}

export function canCreateWidget(input: {
  plan: PlanTier | null | undefined;
  widgetCount: number;
}) {
  return input.widgetCount < getWidgetLimitForPlan(input.plan);
}

export function buildWidgetLimitError(plan: PlanTier | null | undefined) {
  const limit = getWidgetLimitForPlan(plan);

  return plan === "premium"
    ? `Your Premium plan allows up to ${limit} widgets.`
    : `Your current plan allows up to ${limit} widget${limit === 1 ? "" : "s"}. Upgrade to create more.`;
}
