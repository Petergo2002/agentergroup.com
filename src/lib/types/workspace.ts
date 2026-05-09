import type { WorkspaceSubscriptionRecord } from "./subscription";

export interface ProfileRecord {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export interface WorkspaceRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  owner_id: string;
  internal_assistants_enabled: boolean;
  automations_enabled: boolean;
  onboarding_completed: boolean;
}

export interface WorkspaceMemberRecord {
  id: string;
  workspace_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
}

export interface AvailableWorkspace {
  workspace: WorkspaceRecord;
  membership: WorkspaceMemberRecord;
}

export type WorkspaceInviteStatus = "pending" | "accepted" | "revoked";

export interface WorkspaceInviteRecord {
  id: string;
  workspace_id: string;
  email: string;
  role: "admin";
  invited_by: string;
  token: string;
  status: WorkspaceInviteStatus;
  expires_at: string;
  created_at: string;
}

export interface ExpandedWorkspaceInviteRecord extends WorkspaceInviteRecord {
  workspace: { name: string; slug: string };
  inviter: { full_name: string | null; email: string | null; avatar_url: string | null };
}

export interface WorkspaceMemberWithProfile {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceMemberRecord["role"];
  created_at: string;
  profile: ProfileRecord;
}

export interface AppWorkspaceContext {
  profile: ProfileRecord;
  workspace: WorkspaceRecord;
  membership: WorkspaceMemberRecord;
  workspaces: AvailableWorkspace[];
  subscription: WorkspaceSubscriptionRecord;
}
