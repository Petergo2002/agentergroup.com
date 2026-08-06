import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";

test("login uses the right-sized hero image", () => {
  const loginPage = readFileSync("src/app/login/page.tsx", "utf8");
  const optimizedBytes = statSync("public/login-robot-hero.jpg").size;
  const originalBytes = statSync("public/stocksnap-robot-2587571.jpg").size;

  assert.match(loginPage, /src="\/login-robot-hero\.jpg"/);
  assert.ok(optimizedBytes < 400_000);
  assert.ok(optimizedBytes < originalBytes / 5);
});

test("analytics does not request the Google Material Symbols font", () => {
  const layout = readFileSync("src/app/(app)/analytics/layout.tsx", "utf8");
  const view = readFileSync(
    "src/components/analytics/AnalyticsWorkspaceView.tsx",
    "utf8",
  );

  assert.doesNotMatch(layout, /fonts\.googleapis\.com/);
  assert.doesNotMatch(view, /material-symbols-outlined/);
  assert.match(view, /from "lucide-react"/);
});
