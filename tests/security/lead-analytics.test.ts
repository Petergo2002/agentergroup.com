import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLeadAnalytics,
  daysSinceLastLead,
  describeLastLead,
  formatConversionRate,
} from "../../src/lib/admin/lead-analytics.ts";

const DAY_WINDOW = [
  { dateKey: "2026-09-16", label: "Sep 16" },
  { dateKey: "2026-09-17", label: "Sep 17" },
  { dateKey: "2026-09-18", label: "Sep 18" },
];

function lead(createdAt: string, sessionId: string | null = "live-1") {
  return { created_at: createdAt, widget_session_id: sessionId };
}

test("preview leads are excluded from every figure", () => {
  // A lead captured while the owner tested in preview is the owner talking to
  // themselves; counting it overstates how the product is doing for them.
  const analytics = buildLeadAnalytics({
    leads: [
      lead("2026-09-17T10:00:00Z", "live-1"),
      lead("2026-09-17T11:00:00Z", "preview-1"),
      lead("2026-09-18T09:00:00Z", "live-2"),
    ],
    liveSessionIds: new Set(["live-1", "live-2"]),
    conversations: 2,
    dayWindow: DAY_WINDOW,
  });

  assert.equal(analytics.totalLeads, 2);
  assert.equal(analytics.leadsInWindow, 2);
  assert.equal(
    analytics.points.find((p) => p.dateKey === "2026-09-17")?.leadCount,
    1,
  );
});

test("a lead with no session at all is not counted", () => {
  const analytics = buildLeadAnalytics({
    leads: [lead("2026-09-17T10:00:00Z", null)],
    liveSessionIds: new Set(["live-1"]),
    conversations: 1,
    dayWindow: DAY_WINDOW,
  });

  assert.equal(analytics.totalLeads, 0);
});

test("leads outside the window count toward the total but not the window", () => {
  const analytics = buildLeadAnalytics({
    leads: [lead("2026-01-04T10:00:00Z"), lead("2026-09-18T10:00:00Z")],
    liveSessionIds: new Set(["live-1"]),
    conversations: 4,
    dayWindow: DAY_WINDOW,
  });

  assert.equal(analytics.totalLeads, 2);
  assert.equal(analytics.leadsInWindow, 1);
});

test("the most recent lead wins regardless of row order", () => {
  const analytics = buildLeadAnalytics({
    leads: [
      lead("2026-09-18T09:00:00Z"),
      lead("2026-09-16T09:00:00Z"),
      lead("2026-09-17T09:00:00Z"),
    ],
    liveSessionIds: new Set(["live-1"]),
    conversations: 3,
    dayWindow: DAY_WINDOW,
  });

  assert.equal(analytics.lastLeadAt, "2026-09-18T09:00:00Z");
});

test("no conversations yields a null rate, never a damning zero percent", () => {
  // "0%" reads as "this converts badly", which is a different and much worse
  // claim than "nobody has talked to it yet".
  const analytics = buildLeadAnalytics({
    leads: [],
    liveSessionIds: new Set(),
    conversations: 0,
    dayWindow: DAY_WINDOW,
  });

  assert.equal(analytics.conversionRate, null);
  assert.equal(formatConversionRate(analytics.conversionRate), "—");
});

test("conversion rate divides leads by conversations", () => {
  const analytics = buildLeadAnalytics({
    leads: [lead("2026-09-18T09:00:00Z"), lead("2026-09-17T09:00:00Z")],
    liveSessionIds: new Set(["live-1"]),
    conversations: 8,
    dayWindow: DAY_WINDOW,
  });

  assert.equal(analytics.conversionRate, 25);
  assert.equal(formatConversionRate(analytics.conversionRate), "25%");
});

test("a sub-one-percent rate keeps a decimal instead of rounding to zero", () => {
  // Rounding 0.4% to "0%" looks like a bug on a panel whose job is showing
  // that leads are arriving.
  assert.equal(formatConversionRate(0.4), "0.4%");
  assert.equal(formatConversionRate(0), "0%");
  assert.equal(formatConversionRate(3.5), "3.5%");
  assert.equal(formatConversionRate(5), "5%");
  assert.equal(formatConversionRate(12.4), "12%");
  assert.equal(formatConversionRate(25), "25%");
});

test("every day in the window is present, including empty ones", () => {
  const analytics = buildLeadAnalytics({
    leads: [lead("2026-09-17T10:00:00Z")],
    liveSessionIds: new Set(["live-1"]),
    conversations: 1,
    dayWindow: DAY_WINDOW,
  });

  assert.equal(analytics.points.length, 3);
  assert.deepEqual(
    analytics.points.map((p) => p.leadCount),
    [0, 1, 0],
  );
});

// Recency is compared in LOCAL calendar days, so these stamps are built
// locally rather than hardcoded in UTC — a fixed UTC instant lands on a
// different calendar day somewhere across the 26-hour spread of offsets.
const LOCAL_NOW = new Date(2026, 8, 18, 12, 0, 0);

function localDay(offsetDays: number) {
  const date = new Date(LOCAL_NOW);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString();
}

test("last-lead recency reads in plain words", () => {
  assert.equal(describeLastLead(null, LOCAL_NOW), "No leads yet");
  assert.equal(describeLastLead(localDay(0), LOCAL_NOW), "Today");
  assert.equal(describeLastLead(localDay(-1), LOCAL_NOW), "Yesterday");
  assert.equal(describeLastLead(localDay(-6), LOCAL_NOW), "6 days ago");
});

test("recency counts calendar days and never goes negative", () => {
  assert.equal(daysSinceLastLead(localDay(0), LOCAL_NOW), 0);
  assert.equal(daysSinceLastLead(localDay(-1), LOCAL_NOW), 1);
  // A clock skew that puts a lead slightly in the future must not read as -1.
  assert.equal(daysSinceLastLead(localDay(1), LOCAL_NOW), 0);
  assert.equal(daysSinceLastLead(null, LOCAL_NOW), null);
  assert.equal(daysSinceLastLead("not-a-date", LOCAL_NOW), null);
});
