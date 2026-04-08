export class WorkspaceAccessError extends Error {
  status: number;

  constructor(message = "Forbidden") {
    super(message);
    this.name = "WorkspaceAccessError";
    this.status = 403;
  }
}

export function assertOwnedWorkspaceResource<T extends { workspace_id: string }>(
  resource: T | null,
  activeWorkspaceId: string,
  message = "Forbidden",
) {
  if (!resource || resource.workspace_id !== activeWorkspaceId) {
    throw new WorkspaceAccessError(message);
  }

  return resource;
}
