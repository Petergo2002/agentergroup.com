import type { WorkspaceRecord } from "@/lib/types/workspace";

type MiloWorkspace = Pick<
  WorkspaceRecord,
  "product_experience" | "primary_customer_agent_id" | "primary_widget_id"
>;

export function hasValidMiloMapping(workspace: MiloWorkspace) {
  return Boolean(
    workspace.primary_customer_agent_id && workspace.primary_widget_id,
  );
}

export function isMiloMode(
  workspace: MiloWorkspace,
  globallyEnabled: boolean,
) {
  return (
    globallyEnabled &&
    workspace.product_experience === "milo" &&
    hasValidMiloMapping(workspace)
  );
}

export function isMiloNavItemActive(
  pathname: string,
  destination: string,
  workspace: MiloWorkspace,
) {
  if (pathname.startsWith(destination)) return true;
  if (destination === "/milo" && workspace.primary_customer_agent_id) {
    return pathname.startsWith(
      `/agents/${workspace.primary_customer_agent_id}`,
    );
  }
  if (destination === "/website-chat" && workspace.primary_widget_id) {
    return pathname.startsWith(`/widgets/${workspace.primary_widget_id}`);
  }
  return false;
}
