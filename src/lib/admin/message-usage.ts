/**
 * Message quota state for one workspace.
 *
 * Status is a reserved good -> warning -> serious -> critical scale, not a
 * palette choice: it always ships with a label so the state never depends on
 * colour alone.
 */
export type MessageUsageStatus = "good" | "warning" | "serious" | "critical";

export interface MessageUsageSummary {
  used: number;
  limit: number;
  /** Never negative, even when a downgrade puts usage past the new ceiling. */
  remaining: number;
  /** 0-100, clamped, for the meter fill. */
  percentUsed: number;
  status: MessageUsageStatus;
  /** Short state label shown beside the meter. */
  label: string;
  /** Messages spent beyond the limit, or 0. */
  overBy: number;
}

const THRESHOLDS: Array<{ min: number; status: MessageUsageStatus; label: string }> = [
  { min: 100, status: "critical", label: "Limit reached" },
  { min: 90, status: "serious", label: "Almost out" },
  { min: 75, status: "warning", label: "Running low" },
  { min: 0, status: "good", label: "Healthy" },
];

export function describeMessageUsage(input: {
  used: number;
  limit: number;
}): MessageUsageSummary {
  const used = Math.max(0, Math.round(input.used));
  const limit = Math.max(0, Math.round(input.limit));

  // A zero limit is "no allowance", not "0% used" — dividing would give NaN and
  // render an empty, healthy-looking meter for a workspace that cannot send.
  const rawPercent = limit === 0 ? 100 : (used / limit) * 100;
  const percentUsed = Math.min(100, Math.max(0, rawPercent));

  const match =
    THRESHOLDS.find((threshold) => rawPercent >= threshold.min) ??
    THRESHOLDS[THRESHOLDS.length - 1];

  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    percentUsed,
    status: match.status,
    label: match.label,
    overBy: Math.max(0, used - limit),
  };
}
