import type {
  AgentRecord,
  AvailableWorkspace,
  WorkspaceMemberRecord,
} from "@/lib/types";

export function isWorkspaceAdminLike(role: WorkspaceMemberRecord["role"]) {
  return role === "owner" || role === "admin";
}

export function canEditAgentRecord(
  agent: Pick<AgentRecord, "surface" | "created_by">,
  actorUserId: string | null | undefined,
  membershipRole: WorkspaceMemberRecord["role"] | null | undefined,
) {
  if (agent.surface === "widget") {
    return Boolean(membershipRole);
  }

  if (!actorUserId || !membershipRole) {
    return false;
  }

  return agent.created_by === actorUserId || isWorkspaceAdminLike(membershipRole);
}

export function getMembershipRoleForWorkspace(
  workspaces: AvailableWorkspace[],
  workspaceId: string,
) {
  return (
    workspaces.find((entry) => entry.workspace.id === workspaceId)?.membership.role ?? null
  );
}
