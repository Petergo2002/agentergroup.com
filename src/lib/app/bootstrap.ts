import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { slugify, titleFromEmail } from "@/lib/utils";
import type {
  AvailableWorkspace,
  AppWorkspaceContext,
  ProfileRecord,
  WorkspaceMemberRecord,
  WorkspaceRecord,
} from "@/lib/types";

type SupabaseLike = Pick<SupabaseClient, "from">;

interface WorkspaceMembershipQuery {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceMemberRecord["role"];
  workspace: WorkspaceRecord | WorkspaceRecord[];
  created_at?: string;
}

interface DatabaseError {
  code?: string;
}

function buildWorkspaceName(user: User) {
  const candidate =
    user.user_metadata?.workspace_name ||
    user.user_metadata?.full_name ||
    titleFromEmail(user.email);

  return `${candidate} Workspace`;
}

function isDuplicateKeyError(error: unknown): error is DatabaseError {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

function normalizeWorkspace(workspace: WorkspaceRecord | WorkspaceRecord[]): WorkspaceRecord {
  return Array.isArray(workspace) ? workspace[0] : workspace;
}

function normalizeMembership(
  membership: WorkspaceMembershipQuery,
): AvailableWorkspace {
  return {
    workspace: normalizeWorkspace(membership.workspace),
    membership: {
      id: membership.id,
      workspace_id: membership.workspace_id,
      user_id: membership.user_id,
      role: membership.role,
    },
  };
}

function sortAvailableWorkspaces(workspaces: AvailableWorkspace[]) {
  return [...workspaces].sort((left, right) => {
    const leftRank = left.membership.role === "owner" ? 0 : 1;
    const rightRank = right.membership.role === "owner" ? 0 : 1;

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return left.workspace.name.localeCompare(right.workspace.name);
  });
}

function generateWorkspaceSlug(name: string, suffix?: string) {
  const base = slugify(name) || "workspace";
  return suffix ? `${base}-${suffix}` : base;
}

async function createWorkspaceRecord(
  supabase: SupabaseLike,
  input: {
    ownerId: string;
    name: string;
    description: string;
    slugSuffix?: string;
  },
): Promise<WorkspaceRecord> {
  const baseSuffix = input.slugSuffix ?? input.ownerId.slice(0, 8);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const slugSuffix = attempt === 0 ? baseSuffix : `${baseSuffix}-${attempt + 1}`;
    const workspaceInsertResult = await supabase
      .from("workspaces")
      .insert({
        name: input.name,
        slug: generateWorkspaceSlug(input.name, slugSuffix),
        description: input.description,
        owner_id: input.ownerId,
      })
      .select()
      .single();

    if (!workspaceInsertResult.error) {
      return workspaceInsertResult.data as WorkspaceRecord;
    }

    if (!isDuplicateKeyError(workspaceInsertResult.error)) {
      throw workspaceInsertResult.error;
    }
  }

  throw new Error("Failed to generate a unique workspace slug.");
}

export async function createWorkspaceForUser(
  supabase: SupabaseLike,
  user: User,
  input?: {
    name?: string;
    description?: string;
  },
): Promise<AvailableWorkspace> {
  const workspaceName = input?.name?.trim() || buildWorkspaceName(user);
  const workspaceDescription =
    input?.description?.trim() ||
    "Primary workspace for managing agents, connections, and runs.";
  const workspace = await createWorkspaceRecord(supabase, {
    ownerId: user.id,
    name: workspaceName,
    description: workspaceDescription,
  });
  const membershipUpsertResult = await supabase
    .from("workspace_members")
    .upsert(
      {
        workspace_id: workspace.id,
        user_id: user.id,
        role: "owner",
      },
      {
        onConflict: "workspace_id,user_id",
      },
    )
    .select()
    .single();

  if (membershipUpsertResult.error || !membershipUpsertResult.data) {
    throw membershipUpsertResult.error ?? new Error("Failed to create workspace membership.");
  }

  return {
    workspace,
    membership: membershipUpsertResult.data as WorkspaceMemberRecord,
  };
}

async function loadWorkspaceMemberships(
  supabase: SupabaseLike,
  userId: string,
) {
  const membershipResult = await supabase
    .from("workspace_members")
    .select(
      "id, workspace_id, user_id, role, created_at, workspace:workspaces(id, name, slug, description, owner_id)",
    )
    .eq("user_id", userId);

  if (membershipResult.error) {
    throw membershipResult.error;
  }

  return sortAvailableWorkspaces(
    ((membershipResult.data ?? []) as WorkspaceMembershipQuery[]).map(normalizeMembership),
  );
}

async function getOrCreateUserWorkspaces(
  supabase: SupabaseLike,
  user: User,
) {
  const existingWorkspaces = await loadWorkspaceMemberships(supabase, user.id);

  if (existingWorkspaces.length > 0) {
    return existingWorkspaces;
  }

  const createdWorkspace = await createWorkspaceForUser(supabase, user);
  return [createdWorkspace];
}

async function resolveActiveWorkspace(
  availableWorkspaces: AvailableWorkspace[],
) {
  const cookieStore = await cookies();
  const requestedWorkspaceId = cookieStore.get("active_workspace_id")?.value ?? null;

  if (requestedWorkspaceId) {
    const matchingWorkspace = availableWorkspaces.find(
      (entry) => entry.workspace.id === requestedWorkspaceId,
    );

    if (matchingWorkspace) {
      return matchingWorkspace;
    }
  }

  return (
    availableWorkspaces.find((entry) => entry.membership.role === "owner") ??
    availableWorkspaces[0]
  );
}

export async function ensureWorkspaceContext(
  supabase: SupabaseLike,
  user: User,
): Promise<AppWorkspaceContext> {
  const profilePayload = {
    id: user.id,
    email: user.email ?? null,
    full_name:
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      titleFromEmail(user.email),
    avatar_url: user.user_metadata?.avatar_url ?? null,
  };

  const profileResult = await supabase
    .from("profiles")
    .upsert(profilePayload, { onConflict: "id" })
    .select("id, email, full_name, avatar_url")
    .single();

  if (profileResult.error) {
    throw profileResult.error;
  }

  const workspaces = await getOrCreateUserWorkspaces(supabase, user);
  const activeWorkspace = await resolveActiveWorkspace(workspaces);

  return {
    profile: profileResult.data as ProfileRecord,
    workspace: activeWorkspace.workspace,
    membership: activeWorkspace.membership,
    workspaces,
  };
}
