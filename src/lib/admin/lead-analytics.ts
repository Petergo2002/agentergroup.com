export interface LeadAnalyticsPoint {
  dateKey: string;
  label: string;
  leadCount: number;
}

export interface AdminLeadAnalytics {
  /** Live leads ever captured for this workspace. */
  totalLeads: number;
  /**
   * Distinct people behind those captures.
   *
   * The customer's own inbox groups by person, so the admin view has to report
   * the same two numbers or the two screens disagree about what "leads" means.
   */
  uniqueContacts: number;
  /** Live leads captured inside the reporting window. */
  leadsInWindow: number;
  /** Live conversations ever held, the denominator for the rate below. */
  conversations: number;
  /**
   * Leads per 100 conversations, or null when there is nothing to divide by.
   *
   * Null rather than 0: "0%" reads as "this is converting badly", which is a
   * different and much worse claim than "nobody has talked to it yet".
   */
  conversionRate: number | null;
  /** When the most recent live lead arrived. */
  lastLeadAt: string | null;
  points: LeadAnalyticsPoint[];
}

export interface LeadRow {
  created_at: string;
  widget_session_id: string | null;
  email?: string | null;
  phone?: string | null;
}

/**
 * Aggregates lead outcomes for one workspace.
 *
 * Only leads from live sessions count. A lead captured while the owner was
 * testing in preview is the owner talking to themselves, and counting it would
 * overstate how the product is performing for that customer — which is the one
 * question this panel exists to answer.
 */
export function buildLeadAnalytics(input: {
  leads: LeadRow[];
  liveSessionIds: Set<string>;
  conversations: number;
  dayWindow: Array<{ dateKey: string; label: string }>;
}): AdminLeadAnalytics {
  const { leads, liveSessionIds, conversations, dayWindow } = input;

  const countsByDay = new Map<string, number>(
    dayWindow.map((point) => [point.dateKey, 0]),
  );

  let totalLeads = 0;
  let leadsInWindow = 0;
  let lastLeadAt: string | null = null;
  // Same identity rule as the customer inbox: email, else phone, else the
  // capture stands alone rather than merging with other unidentified ones.
  const contactKeys = new Set<string>();

  for (const lead of leads) {
    if (!lead.widget_session_id || !liveSessionIds.has(lead.widget_session_id)) {
      continue;
    }

    totalLeads += 1;

    const email = (lead.email ?? "").trim().toLowerCase();
    const phone = (lead.phone ?? "").replace(/\s|-|\(|\)|\./g, "").trim();
    contactKeys.add(
      email
        ? `email:${email}`
        : phone
          ? `phone:${phone}`
          : `capture:${lead.created_at}:${lead.widget_session_id ?? ""}`,
    );

    if (!lastLeadAt || lead.created_at > lastLeadAt) {
      lastLeadAt = lead.created_at;
    }

    const dayKey = lead.created_at.slice(0, 10);
    if (countsByDay.has(dayKey)) {
      countsByDay.set(dayKey, (countsByDay.get(dayKey) ?? 0) + 1);
      leadsInWindow += 1;
    }
  }

  return {
    totalLeads,
    uniqueContacts: contactKeys.size,
    leadsInWindow,
    conversations,
    conversionRate:
      conversations > 0 ? (totalLeads / conversations) * 100 : null,
    lastLeadAt,
    points: dayWindow.map((point) => ({
      dateKey: point.dateKey,
      label: point.label,
      leadCount: countsByDay.get(point.dateKey) ?? 0,
    })),
  };
}

/** "3.5%", "12%", or "—" when there is nothing to divide by. */
export function formatConversionRate(rate: number | null) {
  if (rate === null) {
    return "—";
  }

  // Keep a decimal below 10%, where rounding destroys the distinction that
  // matters: 3.5% and 4% are meaningfully different when you are watching
  // whether a customer's chat is converting, and 0.4% rounded to "0%" looks
  // like a bug on a panel whose whole job is showing leads arriving. Above
  // 10% the decimal is noise.
  if (rate === 0 || rate >= 10 || Number.isInteger(rate)) {
    return `${Math.round(rate)}%`;
  }

  return `${rate.toFixed(1)}%`;
}

/** Whole days since the last lead, or null when there has never been one. */
export function daysSinceLastLead(
  lastLeadAt: string | null,
  now = new Date(),
): number | null {
  if (!lastLeadAt) {
    return null;
  }

  const last = new Date(lastLeadAt);
  if (Number.isNaN(last.getTime())) {
    return null;
  }

  const startOfDay = (date: Date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

  const dayMs = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.round((startOfDay(now) - startOfDay(last)) / dayMs));
}

/** "Today", "Yesterday", "6 days ago", or "No leads yet". */
export function describeLastLead(
  lastLeadAt: string | null,
  now = new Date(),
): string {
  const days = daysSinceLastLead(lastLeadAt, now);

  if (days === null) {
    return "No leads yet";
  }
  if (days === 0) {
    return "Today";
  }
  if (days === 1) {
    return "Yesterday";
  }

  return `${days} days ago`;
}
