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
