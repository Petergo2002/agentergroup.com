/**
 * Builder previews address agents as `draft:<sortOrder>:<agentId>` while live
 * runtimes use the persisted `widget_agents.id`.
 *
 * A preview draft expires after 15 minutes even though its preview token stays
 * valid, so a browser that bootstrapped against a draft can still be holding
 * draft ids once the server has fallen back to stored agents. Both shapes carry
 * the agent id, which lets a request be matched across that switch instead of
 * being rejected as an unknown widget agent.
 *
 * Dependency-free on purpose so it can be unit tested directly.
 */
const DRAFT_PREVIEW_WIDGET_AGENT_PREFIX = "draft:";

export function buildDraftPreviewWidgetAgentId(
  agentId: string,
  sortOrder: number,
) {
  return `${DRAFT_PREVIEW_WIDGET_AGENT_PREFIX}${sortOrder}:${agentId}`;
}

export function readAgentIdFromDraftPreviewWidgetAgentId(
  widgetAgentId: string | null | undefined,
) {
  if (
    typeof widgetAgentId !== "string" ||
    !widgetAgentId.startsWith(DRAFT_PREVIEW_WIDGET_AGENT_PREFIX)
  ) {
    return null;
  }

  // The agent id is everything after the second separator, so ids containing
  // ":" survive the round trip.
  const separatorIndex = widgetAgentId.indexOf(
    ":",
    DRAFT_PREVIEW_WIDGET_AGENT_PREFIX.length,
  );

  if (separatorIndex === -1) {
    return null;
  }

  return widgetAgentId.slice(separatorIndex + 1) || null;
}
