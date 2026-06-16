import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateWidgetEventBody } from "../../src/lib/validation/widget-schemas.ts";

const uploadRouteSource = readFileSync(
  "src/app/api/public/widgets/[widgetPublicKey]/upload/route.ts",
  "utf8",
);

test("widget event metadata rejects reserved object keys", () => {
  for (const key of ["__proto__", "prototype", "constructor"]) {
    const result = validateWidgetEventBody({
      sessionId: "session_123",
      eventType: "widget_open",
      metadata: {
        [key]: "blocked",
      },
    });

    assert.equal(result.valid, false);
    assert.equal(result.error, "metadata keys cannot use reserved object property names.");
  }
});

test("widget event metadata accepts regular custom keys", () => {
  const result = validateWidgetEventBody({
    sessionId: "session_123",
    eventType: "widget_open",
    metadata: {
      pageTitle: "Home",
      scrollDepth: 75,
      engaged: true,
    },
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.value.metadata, {
    pageTitle: "Home",
    scrollDepth: "75",
    engaged: "true",
  });
});

test("widget upload knowledge uses the internal widget session UUID", () => {
  assert.match(uploadRouteSource, /await upsertWidgetSession/);
  assert.match(uploadRouteSource, /widget_session_id: widgetSession\.id/);
  assert.doesNotMatch(uploadRouteSource, /widget_session_id: sessionId/);
});
