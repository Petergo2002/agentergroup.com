import { PLAN_LIMITS, TRIAL_DURATION_DAYS } from "../plan-limits.ts";
import type { PlanTier } from "../types/subscription.ts";

export type PlanChangeTone = "gain" | "loss" | "warn" | "neutral";

export interface PlanChangeEffect {
  label: string;
  detail: string;
  tone: PlanChangeTone;
}

export interface PlanChangeSummary {
  title: string;
  /** One line stating the headline consequence, above the detail list. */
  summary: string;
  effects: PlanChangeEffect[];
  /** True when something here destroys access the workspace is currently using. */
  isDestructive: boolean;
  confirmLabel: string;
}

const PLAN_LABEL: Record<PlanTier, string> = {
  free: "Free",
  trial: "Trial",
  starter: "Starter",
  premium: "Premium",
};

function formatCount(value: number) {
  // The premium sentinel is a cap nobody reaches; showing "9,999 agents" reads
  // as a real ceiling and invites questions that have no useful answer.
  return value >= 9999 ? "Unlimited" : value.toLocaleString("en-US");
}

function formatDate(value: Date) {
  return value.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Whole calendar days between two instants, in local time.
 *
 * Deliberately not an elapsed-milliseconds division: six hours from now is
 * still "today" to a reader, but `ceil` on the raw delta rounds any part of a
 * day up to 1 and the "today" case never fires. Comparing calendar days also
 * keeps the count consistent with the date printed beside it.
 */
function daysFromNow(value: Date, now: Date) {
  const startOfDay = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

  const dayMs = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(value) - startOfDay(now)) / dayMs);
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** "12 days left — ends Oct 18, 2026", or why the trial is not running. */
export function describeTrialDeadline(
  trialEndsAt: string | null | undefined,
  now = new Date(),
) {
  const endsAt = parseDate(trialEndsAt);

  if (!endsAt) {
    return "No end date set — this trial cannot send messages.";
  }

  const days = daysFromNow(endsAt, now);
  const on = formatDate(endsAt);

  if (days < 0) {
    return `Trial ended ${on}. Messages are blocked until a plan is assigned.`;
  }
  if (days === 0) {
    return `Trial ends today (${on}).`;
  }

  return `${days} day${days === 1 ? "" : "s"} left — ends ${on}.`;
}

/** When the monthly message allowance next returns to zero. */
export function describeCycleReset(
  billingCycleEnd: string | null | undefined,
  now = new Date(),
) {
  const endsAt = parseDate(billingCycleEnd);

  if (!endsAt) {
    return "No billing cycle on record — usage resets on the next message.";
  }

  const days = daysFromNow(endsAt, now);
  const on = formatDate(endsAt);

  if (days < 0) {
    return `Cycle ended ${on} — usage resets on the next message.`;
  }
  if (days === 0) {
    return `Usage resets today (${on}).`;
  }

  return `Usage resets in ${days} day${days === 1 ? "" : "s"} — ${on}.`;
}

export interface PlanChangeContext {
  from: PlanTier;
  to: PlanTier;
  /** Whether the workspace owner already has product access. */
  isActivated: boolean;
  /** Messages already spent in the current cycle. */
  messagesUsed: number;
  /** Agents the workspace has actually built. */
  agentCount: number;
}

/**
 * What an admin is about to do to a live customer workspace.
 *
 * Plan changes take effect immediately and some of them take away access the
 * customer is using right now, so the point of this is to state the losses as
 * plainly as the gains rather than to list every field that changes.
 */
export function describePlanChange(
  context: PlanChangeContext,
): PlanChangeSummary {
  const { from, to, isActivated, messagesUsed, agentCount } = context;
  const before = PLAN_LIMITS[from];
  const after = PLAN_LIMITS[to];
  const effects: PlanChangeEffect[] = [];
  let isDestructive = false;

  const messagePeriod =
    to === "trial" ? `for the whole ${TRIAL_DURATION_DAYS} days` : "per month";

  if (before.messages_limit !== after.messages_limit || from !== to) {
    effects.push({
      label: "Messages",
      detail: `${formatCount(before.messages_limit)} → ${formatCount(
        after.messages_limit,
      )} ${messagePeriod}`,
      tone:
        after.messages_limit > before.messages_limit
          ? "gain"
          : after.messages_limit < before.messages_limit
            ? "loss"
            : "neutral",
    });
  }

  if (before.agents_limit !== after.agents_limit) {
    effects.push({
      label: "Agents",
      detail: `${formatCount(before.agents_limit)} → ${formatCount(after.agents_limit)}`,
      tone: after.agents_limit > before.agents_limit ? "gain" : "loss",
    });
  }

  if (before.integrations_enabled !== after.integrations_enabled) {
    effects.push({
      label: "Integrations",
      detail: after.integrations_enabled
        ? "Off → On. Calendar and email tools become available."
        : "On → Off. Connected calendar and email tools stop working.",
      tone: after.integrations_enabled ? "gain" : "loss",
    });
    if (!after.integrations_enabled) {
      isDestructive = true;
    }
  }

  // Concrete consequences for what this workspace has actually built and used.
  if (agentCount > after.agents_limit) {
    effects.push({
      label: "Over the agent limit",
      detail: `This workspace has ${formatCount(agentCount)} agents but ${PLAN_LABEL[to]} allows ${formatCount(after.agents_limit)}.`,
      tone: "warn",
    });
    isDestructive = true;
  }

  if (to === "trial") {
    effects.push({
      label: "Usage",
      detail: `Resets to 0. ${formatCount(messagesUsed)} message${
        messagesUsed === 1 ? "" : "s"
      } already spent will be cleared.`,
      tone: "neutral",
    });
    effects.push({
      label: "Expires",
      detail: `${TRIAL_DURATION_DAYS} days from now, after which the workspace stops sending until a plan is assigned.`,
      tone: "warn",
    });
  } else {
    if (messagesUsed > after.messages_limit) {
      effects.push({
        label: "Already over the new limit",
        detail: `${formatCount(messagesUsed)} of ${formatCount(
          after.messages_limit,
        )} messages are already spent, so sending stops immediately.`,
        tone: "warn",
      });
      isDestructive = true;
    } else {
      effects.push({
        label: "Usage",
        detail: `Carries over unchanged — ${formatCount(messagesUsed)} of ${formatCount(
          after.messages_limit,
        )} spent.`,
        tone: "neutral",
      });
    }

    if (from === "trial") {
      effects.push({
        label: "Trial",
        detail: "Ends now. The 30-day deadline is cleared.",
        tone: "neutral",
      });
    }
  }

  if (!isActivated) {
    effects.push({
      label: "Access",
      detail: "Unlocks the workspace for the customer and ends onboarding.",
      tone: "gain",
    });
  }

  const title = isActivated
    ? `Change ${PLAN_LABEL[from]} → ${PLAN_LABEL[to]}?`
    : `Activate this workspace on ${PLAN_LABEL[to]}?`;

  const summary = isActivated
    ? `This applies immediately to a live customer workspace.${
        isDestructive ? " It removes access they are using right now." : ""
      }`
    : "This unlocks the product for the customer and cannot be undone by them.";

  return {
    title,
    summary,
    effects,
    isDestructive,
    confirmLabel: isActivated
      ? `Change to ${PLAN_LABEL[to]}`
      : `Activate ${PLAN_LABEL[to]}`,
  };
}
