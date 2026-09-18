import assert from "node:assert/strict";
import test from "node:test";
import { describeMessageUsage } from "../../src/lib/admin/message-usage.ts";

test("an untouched allowance reads healthy and empty", () => {
  const usage = describeMessageUsage({ used: 0, limit: 500 });

  assert.equal(usage.remaining, 500);
  assert.equal(usage.percentUsed, 0);
  assert.equal(usage.status, "good");
  assert.equal(usage.label, "Healthy");
});

test("the status scale steps at 75, 90 and 100 percent", () => {
  assert.equal(describeMessageUsage({ used: 374, limit: 500 }).status, "good");
  assert.equal(
    describeMessageUsage({ used: 375, limit: 500 }).status,
    "warning",
  );
  assert.equal(
    describeMessageUsage({ used: 449, limit: 500 }).status,
    "warning",
  );
  assert.equal(
    describeMessageUsage({ used: 450, limit: 500 }).status,
    "serious",
  );
  assert.equal(
    describeMessageUsage({ used: 499, limit: 500 }).status,
    "serious",
  );
  assert.equal(
    describeMessageUsage({ used: 500, limit: 500 }).status,
    "critical",
  );
});

test("every status carries a word, so colour is never the only signal", () => {
  for (const used of [0, 400, 470, 500]) {
    const usage = describeMessageUsage({ used, limit: 500 });
    assert.ok(usage.label.length > 0, `expected a label at ${used}`);
  }
});

test("a downgrade past the ceiling does not produce a negative remainder", () => {
  // A Premium workspace with 900 spent, moved to Free, is a real case — the
  // plan-change confirmation warns about exactly this.
  const usage = describeMessageUsage({ used: 900, limit: 50 });

  assert.equal(usage.remaining, 0);
  assert.equal(usage.overBy, 850);
  assert.equal(usage.status, "critical");
  // The bar must not overflow its track.
  assert.equal(usage.percentUsed, 100);
});

test("a zero limit is no allowance, not a healthy empty meter", () => {
  // Dividing by zero would give NaN and render an empty, healthy-looking bar
  // for a workspace that cannot send a single message.
  const usage = describeMessageUsage({ used: 0, limit: 0 });

  assert.equal(usage.percentUsed, 100);
  assert.equal(usage.status, "critical");
  assert.equal(usage.remaining, 0);
  assert.ok(Number.isFinite(usage.percentUsed));
});

test("negative or fractional inputs are normalised", () => {
  const usage = describeMessageUsage({ used: -5, limit: 500.4 });

  assert.equal(usage.used, 0);
  assert.equal(usage.limit, 500);
  assert.equal(usage.remaining, 500);
});

test("the meter fill never leaves the 0-100 range", () => {
  for (const [used, limit] of [
    [0, 100],
    [50, 100],
    [100, 100],
    [5000, 100],
    [0, 0],
    [-10, 100],
  ] as const) {
    const { percentUsed } = describeMessageUsage({ used, limit });
    assert.ok(
      percentUsed >= 0 && percentUsed <= 100,
      `percentUsed ${percentUsed} out of range for ${used}/${limit}`,
    );
  }
});
