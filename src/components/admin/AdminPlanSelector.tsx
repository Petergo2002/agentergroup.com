"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PlanTier } from "@/lib/types/subscription";

interface AdminPlanSelectorProps {
  workspaceId: string;
  /** The plan tier currently stored in workspace_subscriptions. */
  currentPlan: PlanTier;
}

/** Visual metadata for each plan tier. */
const PLAN_META: Record<
  PlanTier,
  { label: string; badgeClasses: string; description: string }
> = {
  free: {
    label: "Free",
    badgeClasses: "bg-surface-container-high text-on-surface-variant",
    description: "50 messages / 1 agent / No integrations",
  },
  starter: {
    label: "Starter",
    badgeClasses: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    description: "500 messages / 3 agents / Integrations",
  },
  premium: {
    label: "Premium",
    badgeClasses: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    description: "4,000 messages / Unlimited agents / Integrations",
  },
};

const ALL_PLANS: PlanTier[] = ["free", "starter", "premium"];

/**
 * Admin-only component that lets an internal admin change the subscription
 * plan for a workspace. Changes are applied immediately via a PATCH request.
 *
 * Pattern mirrors AdminInternalAssistantsToggle: optimistic local state +
 * router.refresh() on success.
 */
export function AdminPlanSelector({
  workspaceId,
  currentPlan,
}: AdminPlanSelectorProps) {
  const router = useRouter();
  const [activePlan, setActivePlan] = useState<PlanTier>(currentPlan);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePlanChange = async (plan: PlanTier) => {
    // No-op if clicking the already-active plan.
    if (plan === activePlan || isSaving) return;

    setIsSaving(true);
    setErrorMessage(null);

    // Optimistically update the local state for instant feedback.
    const previous = activePlan;
    setActivePlan(plan);

    try {
      const response = await fetch(
        `/api/admin/workspaces/${workspaceId}/plan`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan_tier: plan }),
        },
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.subscription) {
        // Revert on failure.
        setActivePlan(previous);
        throw new Error(payload?.error || "Failed to update plan.");
      }

      router.refresh();
    } catch (error) {
      setActivePlan(previous);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to update plan.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const meta = PLAN_META[activePlan];

  return (
    <div className="rounded-2xl border border-outline bg-surface p-4 shadow-tactile">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-on-surface-variant">
            Subscription Plan
          </p>
          {/* Current plan badge */}
          <div
            className={`inline-flex rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${meta.badgeClasses}`}
          >
            {meta.label}
          </div>
          <p className="text-[11px] text-on-surface-variant">{meta.description}</p>
        </div>
      </div>

      {/* Plan selector buttons */}
      <div className="mt-4 flex gap-2">
        {ALL_PLANS.map((plan) => {
          const isActive = plan === activePlan;
          return (
            <button
              key={plan}
              type="button"
              disabled={isSaving}
              onClick={() => void handlePlanChange(plan)}
              className={`flex-1 rounded-xl px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition-all
                ${
                  isActive
                    ? plan === "premium"
                      ? "bg-amber-500/20 text-amber-700 ring-1 ring-amber-500/30 dark:text-amber-300"
                      : plan === "starter"
                        ? "bg-sky-500/20 text-sky-700 ring-1 ring-sky-500/30 dark:text-sky-300"
                        : "bg-surface-container-high text-on-surface ring-1 ring-outline"
                    : "bg-transparent text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {PLAN_META[plan].label}
            </button>
          );
        })}
      </div>

      {/* Saving indicator */}
      {isSaving && (
        <p className="mt-3 text-[11px] text-on-surface-variant">Applying plan...</p>
      )}

      {/* Error message */}
      {errorMessage && (
        <p className="mt-3 text-xs text-error">{errorMessage}</p>
      )}
    </div>
  );
}
