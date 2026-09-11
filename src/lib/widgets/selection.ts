import type { RuntimeWidgetAgentSelection } from "./server-types";

export type ResolveSelectedWidgetAgentResult =
  | { selected: RuntimeWidgetAgentSelection; error?: never }
  | { error: string; status: number; code: string; selected?: never };

export function resolveSelectedWidgetAgent(args: {
  widgetAgents: RuntimeWidgetAgentSelection[];
  activeWidgetAgentId: string | null;
  activeAgentId: string | null;
  requestedWidgetAgentId: string | null;
  /**
   * The agent behind `requestedWidgetAgentId`, when the caller can resolve it.
   * Preview drafts and live runtimes address the same agent with different
   * widget-agent ids, and a draft expires while its preview token is still
   * valid, so a browser can legitimately send an id from the other shape.
   */
  requestedAgentId?: string | null;
}): ResolveSelectedWidgetAgentResult {
  const {
    widgetAgents,
    activeWidgetAgentId,
    activeAgentId,
    requestedWidgetAgentId,
    requestedAgentId = null,
  } = args;

  if (widgetAgents.length === 0) {
    return {
      error: "This widget has no attached agents yet.",
      status: 400,
      code: "NO_WIDGET_AGENTS",
    };
  }

  const selectedFromSession = activeWidgetAgentId
    ? widgetAgents.find((item) => item.widgetAgentId === activeWidgetAgentId) ?? null
    : null;

  const selectedFromAgentSession =
    !selectedFromSession && activeAgentId
      ? widgetAgents.find((item) => item.agent.id === activeAgentId) ?? null
      : null;

  if (activeWidgetAgentId && !selectedFromSession && !selectedFromAgentSession) {
    return {
      error: "This conversation is bound to an agent that is no longer attached. Start a new chat.",
      status: 409,
      code: "SESSION_AGENT_INVALID",
    };
  }

  const selectedFromRequest = requestedWidgetAgentId
    ? widgetAgents.find((item) => item.widgetAgentId === requestedWidgetAgentId) ??
      (requestedAgentId
        ? widgetAgents.find((item) => item.agent.id === requestedAgentId) ?? null
        : null)
    : null;

  if (requestedWidgetAgentId && !selectedFromRequest) {
    return {
      error: "The selected widget agent is not attached to this widget.",
      status: 400,
      code: "INVALID_WIDGET_AGENT",
    };
  }

  const lockedSelection = selectedFromSession ?? selectedFromAgentSession;

  if (lockedSelection) {
    if (
      selectedFromRequest &&
      selectedFromRequest.widgetAgentId !== lockedSelection.widgetAgentId
    ) {
      return {
        error: "Switching agent requires a new session.",
        status: 409,
        code: "AGENT_SWITCH_REQUIRES_NEW_SESSION",
      };
    }

    return { selected: lockedSelection };
  }

  if (widgetAgents.length === 1) {
    return { selected: widgetAgents[0] };
  }

  if (selectedFromRequest) {
    return { selected: selectedFromRequest };
  }

  return {
    error: "widgetAgentId is required when multiple agents are attached.",
    status: 400,
    code: "WIDGET_AGENT_REQUIRED",
  };
}
