import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildDraftPreviewWidgetAgentId,
  readAgentIdFromDraftPreviewWidgetAgentId,
} from "../../src/lib/widgets/draft-agent-id.ts";

const chatRoute = readFileSync(
  "src/app/api/public/widgets/[widgetPublicKey]/chat/route.ts",
  "utf8",
);
const leadsRoute = readFileSync(
  "src/app/api/public/widgets/[widgetPublicKey]/leads/route.ts",
  "utf8",
);

const AGENT_ID = "7fab1f1d-9df5-455b-b0ca-cbec996f87e3";
const STORED_WIDGET_AGENT_ID = "81040331-1888-4929-ab70-f55bc5ab466c";

test("a draft preview widget-agent id round trips back to its agent", () => {
  const draftId = buildDraftPreviewWidgetAgentId(AGENT_ID, 0);
  assert.equal(draftId, `draft:0:${AGENT_ID}`);
  assert.equal(readAgentIdFromDraftPreviewWidgetAgentId(draftId), AGENT_ID);

  // Sort order is not assumed to be a single digit.
  assert.equal(
    readAgentIdFromDraftPreviewWidgetAgentId(
      buildDraftPreviewWidgetAgentId(AGENT_ID, 12),
    ),
    AGENT_ID,
  );
});

test("stored widget-agent ids are not mistaken for draft ids", () => {
  assert.equal(
    readAgentIdFromDraftPreviewWidgetAgentId(STORED_WIDGET_AGENT_ID),
    null,
  );
  assert.equal(readAgentIdFromDraftPreviewWidgetAgentId(null), null);
  assert.equal(readAgentIdFromDraftPreviewWidgetAgentId(""), null);
  // Prefix present but no second separator is not a usable draft id.
  assert.equal(readAgentIdFromDraftPreviewWidgetAgentId("draft:0"), null);
  assert.equal(readAgentIdFromDraftPreviewWidgetAgentId("draft:0:"), null);
});

test("both public widget routes match a request across the draft/stored switch", () => {
  // A preview draft expires after 15 minutes while its preview token stays
  // valid, so the server falls back to stored agents while the browser is still
  // holding draft ids from bootstrap. Without this the second message in a
  // conversation failed with INVALID_WIDGET_AGENT.
  for (const [name, route] of [
    ["chat", chatRoute],
    ["leads", leadsRoute],
  ] as const) {
    assert.match(
      route,
      /readAgentIdFromDraftPreviewWidgetAgentId\(requestedWidgetAgentId\)/,
      `${name} route should resolve draft ids back to an agent`,
    );
    assert.match(
      route,
      /loaded\.widgetAgents\.find\(\s*\(entry\) => entry\.widgetAgent\.id === requestedWidgetAgentId,?\s*\)\?\.agent\.id/,
      `${name} route should resolve stored ids back to an agent`,
    );
    assert.match(
      route,
      /requestedAgentId,\s*\}\);/,
      `${name} route should pass the resolved agent id to the matcher`,
    );
    // The fallback must be a fallback: an exact widget-agent id still wins.
    assert.match(
      route,
      /widgetAgents\.find\(\(item\) => item\.widgetAgentId === requestedWidgetAgentId\) \?\?\s*\(requestedAgentId/,
      `${name} route should prefer an exact widget-agent id match`,
    );
  }
});

test("the switch does not weaken agent scoping", () => {
  // Matching is still confined to the agents attached to this widget, so an
  // agent id from another widget or workspace cannot be selected.
  for (const route of [chatRoute, leadsRoute]) {
    assert.match(
      route,
      /widgetAgents\.find\(\(item\) => item\.agent\.id === requestedAgentId\)/,
    );
    // The unknown-agent rejection is still present.
    assert.match(route, /INVALID_WIDGET_AGENT/);
    assert.match(
      route,
      /if \(requestedWidgetAgentId && !selectedFromRequest\)/,
    );
  }
});
