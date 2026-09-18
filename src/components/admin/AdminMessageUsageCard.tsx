"use client";

import {
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  OctagonAlert,
  TriangleAlert,
} from "lucide-react";
import {
  describeMessageUsage,
  type MessageUsageStatus,
} from "@/lib/admin/message-usage";
import {
  describeCycleReset,
  describeTrialDeadline,
} from "@/lib/admin/plan-change";
import type { PlanTier } from "@/lib/types/subscription";

interface AdminMessageUsageCardProps {
  messagesUsed: number;
  messagesLimit: number;
  planTier: PlanTier;
  /** When the allowance next returns to zero. */
  billingCycleEnd: string | null;
  /** When a trial stops allowing messages. Null unless planTier is "trial". */
  trialEndsAt: string | null;
}

/**
 * The meter's fill carries the severity and its track is a lighter step of the
 * same hue, so the state reads across the whole bar rather than only from the
 * filled portion. Every status also carries an icon and a word — never colour
 * on its own.
 */
const STATUS_STYLES: Record<
  MessageUsageStatus,
  { fill: string; track: string; text: string; Icon: typeof CheckCircle2 }
> = {
  good: {
    fill: "bg-emerald-500",
    track: "bg-emerald-500/15",
    text: "text-emerald-700 dark:text-emerald-300",
    Icon: CheckCircle2,
  },
  warning: {
    fill: "bg-amber-500",
    track: "bg-amber-500/15",
    text: "text-amber-700 dark:text-amber-300",
    Icon: AlertTriangle,
  },
  serious: {
    fill: "bg-orange-600",
    track: "bg-orange-600/15",
    text: "text-orange-700 dark:text-orange-300",
    Icon: TriangleAlert,
  },
  critical: {
    fill: "bg-error",
    track: "bg-error/15",
    text: "text-error",
    Icon: OctagonAlert,
  },
};

export function AdminMessageUsageCard({
  messagesUsed,
  messagesLimit,
  planTier,
  billingCycleEnd,
  trialEndsAt,
}: AdminMessageUsageCardProps) {
  const usage = describeMessageUsage({
    used: messagesUsed,
    limit: messagesLimit,
  });
  const style = STATUS_STYLES[usage.status];
  const { Icon } = style;

  const renewal =
    planTier === "trial"
      ? describeTrialDeadline(trialEndsAt)
      : describeCycleReset(billingCycleEnd);

  return (
    <div className="rounded-2xl border border-outline bg-surface p-4 shadow-tactile">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-on-surface-variant">
            Message usage
          </p>
          {/* Proportional figures: tabular-nums gives every digit the width of
              a zero, which reads loose at this size. */}
          <p className="mt-2 text-3xl font-semibold leading-none text-on-surface">
            {usage.remaining.toLocaleString("en-US")}
          </p>
          <p className="mt-1.5 text-[11px] text-on-surface-variant">
            left of {usage.limit.toLocaleString("en-US")}
          </p>
        </div>
        <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
          <MessageSquare aria-hidden className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-4">
        <div
          className={`h-2 w-full overflow-hidden rounded-full ${style.track}`}
          role="progressbar"
          aria-valuenow={Math.round(usage.percentUsed)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${usage.used.toLocaleString("en-US")} of ${usage.limit.toLocaleString(
            "en-US",
          )} messages used`}
        >
          <div
            className={`h-full rounded-full transition-[width] duration-300 ${style.fill}`}
            style={{ width: `${usage.percentUsed}%` }}
          />
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-3">
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${style.text}`}
          >
            <Icon aria-hidden className="h-3.5 w-3.5" />
            {usage.label}
          </span>
          <span className="text-[11px] tabular-nums text-on-surface-variant">
            {usage.used.toLocaleString("en-US")} used ·{" "}
            {Math.round(usage.percentUsed)}%
          </span>
        </div>
      </div>

      {usage.overBy > 0 ? (
        <p className="mt-3 rounded-xl bg-error/10 px-3 py-2 text-[11px] font-medium text-error">
          {usage.overBy.toLocaleString("en-US")} message
          {usage.overBy === 1 ? "" : "s"} over the limit. Sending is blocked
          until the allowance resets or the plan changes.
        </p>
      ) : null}

      <p className="mt-3 text-[11px] text-on-surface-variant">{renewal}</p>
    </div>
  );
}
