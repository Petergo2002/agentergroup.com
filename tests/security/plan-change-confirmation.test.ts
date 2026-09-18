import assert from "node:assert/strict";
import test from "node:test";
import {
  describeCycleReset,
  describePlanChange,
  describeTrialDeadline,
} from "../../src/lib/admin/plan-change.ts";

// Built in LOCAL time, because the helpers under test compare local calendar
// days. Any fixed UTC instant lands on a different calendar day somewhere
// across the 26-hour spread of real offsets, so a hardcoded "...T12:00:00Z"
// passes in Stockholm and fails in Auckland.
const NOW = new Date(2026, 8, 18, 12, 0, 0);

/** An ISO stamp for local midday, `offsetDays` from NOW. */
function localDay(offsetDays: number) {
  const date = new Date(NOW);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString();
}

/** How that same day is rendered, so assertions never hardcode a format. */
function renderedDay(offsetDays: number) {
  const date = new Date(NOW);
  date.setDate(date.getDate() + offsetDays);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function change(overrides: Partial<Parameters<typeof describePlanChange>[0]>) {
  return describePlanChange({
    from: "free",
    to: "premium",
    isActivated: true,
    messagesUsed: 0,
    agentCount: 0,
    ...overrides,
  });
}

function detailFor(
  summary: ReturnType<typeof describePlanChange>,
  label: string,
) {
  return summary.effects.find((effect) => effect.label === label)?.detail ?? "";
}

test("an upgrade states the gains and is not flagged destructive", () => {
  const summary = change({ from: "free", to: "premium" });

  assert.match(summary.title, /Free → Premium/);
  assert.equal(summary.isDestructive, false);
  assert.match(detailFor(summary, "Messages"), /50 → 4,000 per month/);
  assert.match(detailFor(summary, "Agents"), /1 → Unlimited/);
  assert.match(detailFor(summary, "Integrations"), /Off → On/);
});

test("a downgrade that switches integrations off is destructive", () => {
  const summary = change({ from: "premium", to: "free" });

  assert.equal(summary.isDestructive, true);
  assert.match(detailFor(summary, "Integrations"), /On → Off/);
  assert.match(detailFor(summary, "Integrations"), /stop working/);
  assert.match(summary.summary, /removes access they are using right now/);
});

test("a downgrade below what the workspace already built is called out", () => {
  const summary = change({ from: "premium", to: "starter", agentCount: 7 });

  assert.equal(summary.isDestructive, true);
  assert.match(
    detailFor(summary, "Over the agent limit"),
    /has 7 agents but Starter allows 3/,
  );
});

test("a downgrade below current usage says sending stops immediately", () => {
  const summary = change({ from: "premium", to: "free", messagesUsed: 900 });

  assert.equal(summary.isDestructive, true);
  assert.match(
    detailFor(summary, "Already over the new limit"),
    /900 of 50 messages are already spent, so sending stops immediately/,
  );
});

test("granting a trial warns that usage is wiped and that it expires", () => {
  const summary = change({ from: "free", to: "trial", messagesUsed: 40 });

  assert.match(detailFor(summary, "Usage"), /Resets to 0/);
  assert.match(detailFor(summary, "Usage"), /40 messages already spent/);
  assert.match(detailFor(summary, "Expires"), /30 days from now/);
  // The trial's 500 is for the whole window, not a monthly allowance.
  assert.match(detailFor(summary, "Messages"), /for the whole 30 days/);
});

test("leaving a trial says the trial ends now", () => {
  const summary = change({ from: "trial", to: "starter", messagesUsed: 120 });

  assert.match(detailFor(summary, "Trial"), /Ends now/);
  assert.match(detailFor(summary, "Usage"), /Carries over unchanged/);
});

test("activating a pending workspace is framed as unlocking access", () => {
  const summary = change({ isActivated: false, to: "starter" });

  assert.match(summary.title, /Activate this workspace on Starter/);
  assert.match(summary.confirmLabel, /Activate Starter/);
  assert.match(detailFor(summary, "Access"), /Unlocks the workspace/);
});

test("trial deadlines read correctly either side of the date", () => {
  // Midday UTC throughout: evening stamps roll into the next local day east
  // of UTC+6 and these assertions would pass here but fail in CI.
  assert.equal(
    describeTrialDeadline(localDay(12), NOW),
    `12 days left — ends ${renderedDay(12)}.`,
  );
  assert.match(describeTrialDeadline(localDay(0), NOW), /ends today/);
  assert.equal(
    describeTrialDeadline(localDay(-8), NOW),
    `Trial ended ${renderedDay(-8)}. Messages are blocked until a plan is assigned.`,
  );
  // A trial with no deadline cannot send, so the panel must not imply it can.
  assert.match(describeTrialDeadline(null, NOW), /cannot send messages/);
});

test("the reset line reads correctly either side of the cycle end", () => {
  assert.equal(
    describeCycleReset(localDay(13), NOW),
    `Usage resets in 13 days — ${renderedDay(13)}.`,
  );
  assert.match(describeCycleReset(localDay(0), NOW), /resets today/);
  assert.equal(
    describeCycleReset(localDay(-17), NOW),
    `Cycle ended ${renderedDay(-17)} — usage resets on the next message.`,
  );
  assert.match(describeCycleReset(null, NOW), /No billing cycle on record/);
});

test("a single day is not pluralised", () => {
  assert.match(describeTrialDeadline(localDay(1), NOW), /1 day left/);
  assert.match(describeCycleReset(localDay(1), NOW), /in 1 day —/);
});
