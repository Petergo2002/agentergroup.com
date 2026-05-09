import type { AgentRecord, WorkspaceRecord } from "@/lib/types";

export const INTERNAL_ASSISTANTS_DISABLED_CODE = "INTERNAL_ASSISTANTS_DISABLED";
export const INTERNAL_ASSISTANTS_DISABLED_MESSAGE =
  "Internal assistants are not enabled for this workspace.";

export function hasInternalAssistantsEnabled(
  workspace:
    | Pick<WorkspaceRecord, "internal_assistants_enabled">
    | null
    | undefined,
) {
  return workspace?.internal_assistants_enabled === true;
}

export function isInternalAssistantBlocked(
  agent: Pick<AgentRecord, "surface">,
  workspace:
    | Pick<WorkspaceRecord, "internal_assistants_enabled">
    | null
    | undefined,
) {
  return agent.surface === "assistant" && !hasInternalAssistantsEnabled(workspace);
}

export const AUTOMATIONS_DISABLED_CODE = "AUTOMATIONS_DISABLED";
export const AUTOMATIONS_DISABLED_MESSAGE =
  "Automations are not enabled for this workspace.";

/**
 * Returns true if the workspace has the automation beta feature enabled.
 * Automations are off by default — enabled per-workspace from the admin panel.
 */
export function hasAutomationsEnabled(
  workspace:
    | Pick<WorkspaceRecord, "automations_enabled">
    | null
    | undefined,
) {
  return workspace?.automations_enabled === true;
}

/**
 * Returns true when an automation agent should be blocked because
 * the workspace has not had automations enabled by an admin.
 */
export function isAutomationBlocked(
  agent: Pick<AgentRecord, "surface">,
  workspace:
    | Pick<WorkspaceRecord, "automations_enabled">
    | null
    | undefined,
) {
  return agent.surface === "automation" && !hasAutomationsEnabled(workspace);
}
