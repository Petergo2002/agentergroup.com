import type { SupabaseClient, User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { slugify, titleFromEmail } from "@/lib/utils";
import { syncUserProfile } from "@/lib/app/profile-sync";
import type {
  AvailableWorkspace,
  AppWorkspaceContext,
  WorkspaceMemberRecord,
  WorkspaceRecord,
  WorkspaceSubscriptionRecord,
} from "@/lib/types";
import { provisionWorkspaceMilo } from "@/lib/milo/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = Pick<SupabaseClient<any>, "from">;

const WORKSPACE_SELECT = "id, name, slug, description, owner_id, internal_assistants_enabled, automations_enabled, onboarding_completed, product_experience, primary_customer_agent_id, primary_widget_id";

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
  const explicitWorkspace =
    typeof user.user_metadata?.workspace_name === "string"
      ? user.user_metadata.workspace_name.trim()
      : "";

  if (explicitWorkspace) {
    return explicitWorkspace;
  }

  const candidate =
    user.user_metadata?.full_name?.trim() ||
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

async function createWorkspaceMembership(
  supabase: SupabaseLike,
  input: {
    workspaceId: string;
    userId: string;
  },
) {
  const membershipUpsertResult = await supabase
    .from("workspace_members")
    .upsert(
      {
        workspace_id: input.workspaceId,
        user_id: input.userId,
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

  return membershipUpsertResult.data as WorkspaceMemberRecord;
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
    "Primary workspace for Milo, Website Chat, connections, and knowledge.";
  const workspace = await createWorkspaceRecord(supabase, {
    ownerId: user.id,
    name: workspaceName,
    description: workspaceDescription,
  });
  const membership = await createWorkspaceMembership(supabase, {
    workspaceId: workspace.id,
    userId: user.id,
  });

  try {
    const result = await provisionWorkspaceMilo({ workspaceId: workspace.id, actorId: user.id });
    workspace.product_experience = "milo";
    workspace.primary_customer_agent_id = result.agentId;
    workspace.primary_widget_id = result.widgetId;
  } catch (error) {
    console.error("Milo provisioning failed during workspace creation", {
      workspaceId: workspace.id,
      code: error instanceof Error ? error.message : "milo_provision_failed",
    });
  }

  return {
    workspace,
    membership,
  };
}

async function loadOwnedWorkspaceBySlug(
  supabase: SupabaseLike,
  input: {
    ownerId: string;
    slug: string;
  },
) {
  const workspaceResult = await supabase
    .from("workspaces")
    .select(WORKSPACE_SELECT)
    .eq("owner_id", input.ownerId)
    .eq("slug", input.slug)
    .maybeSingle();

  if (workspaceResult.error) {
    throw workspaceResult.error;
  }

  return workspaceResult.data as WorkspaceRecord | null;
}

async function createPrimaryWorkspaceForUser(
  supabase: SupabaseLike,
  user: User,
): Promise<AvailableWorkspace> {
  const workspaceName = buildWorkspaceName(user);
  const workspaceDescription = "Primary workspace for Milo, Website Chat, connections, and knowledge.";
  const slug = generateWorkspaceSlug(workspaceName, user.id.slice(0, 8));

  const workspaceInsertResult = await supabase
    .from("workspaces")
    .insert({
      name: workspaceName,
      slug,
      description: workspaceDescription,
      owner_id: user.id,
    })
    .select()
    .single();

  if (workspaceInsertResult.error && !isDuplicateKeyError(workspaceInsertResult.error)) {
    throw workspaceInsertResult.error;
  }

  const workspace = workspaceInsertResult.error
    ? await loadOwnedWorkspaceBySlug(supabase, { ownerId: user.id, slug })
    : (workspaceInsertResult.data as WorkspaceRecord);

  if (!workspace) {
    throw new Error("Failed to load primary workspace after concurrent creation.");
  }

  const membership = await createWorkspaceMembership(supabase, {
    workspaceId: workspace.id,
    userId: user.id,
  });

  try {
    const result = await provisionWorkspaceMilo({ workspaceId: workspace.id, actorId: user.id });
    workspace.product_experience = "milo";
    workspace.primary_customer_agent_id = result.agentId;
    workspace.primary_widget_id = result.widgetId;
  } catch (error) {
    console.error("Milo provisioning failed during primary workspace creation", {
      workspaceId: workspace.id,
      code: error instanceof Error ? error.message : "milo_provision_failed",
    });
  }

  return {
    workspace,
    membership,
  };
}

async function loadWorkspaceMemberships(
  supabase: SupabaseLike,
  userId: string,
) {
  const membershipResult = await supabase
    .from("workspace_members")
    .select(
      `id, workspace_id, user_id, role, created_at, workspace:workspaces(${WORKSPACE_SELECT})`,
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
  // 1. First attempt to load existing memberships
  const existingWorkspaces = await loadWorkspaceMemberships(supabase, user.id);

  if (existingWorkspaces.length > 0) {
    return existingWorkspaces;
  }

  // 2. If none exist, we try to create one.
  // We use a small delay or a retry logic to handle potential race conditions
  // where two concurrent requests both try to create a workspace.
  try {
    const createdWorkspace = await createPrimaryWorkspaceForUser(supabase, user);
    return [createdWorkspace];
  } catch (error) {
    // 3. If creation fails (e.g. due to a slug conflict or other race condition), 
    // we do a final check for memberships that might have been created by another process.
    const finalCheck = await loadWorkspaceMemberships(supabase, user.id);
    if (finalCheck.length > 0) {
      return finalCheck;
    }
    throw error;
  }
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

interface CachedWorkspaceContext {
  context: AppWorkspaceContext;
  expiresAt: number;
}

const WORKSPACE_CONTEXT_TTL_MS = 30_000;
const workspaceContextCache = new Map<string, CachedWorkspaceContext>();

export function invalidateWorkspaceContextCache(userId?: string, workspaceId?: string) {
  if (!userId && !workspaceId) {
    workspaceContextCache.clear();
    return;
  }
  for (const [key, value] of Array.from(workspaceContextCache.entries())) {
    if (userId && key.startsWith(`${userId}:`)) {
      workspaceContextCache.delete(key);
    } else if (workspaceId && value.context.workspace.id === workspaceId) {
      workspaceContextCache.delete(key);
    }
  }
}

export async function ensureWorkspaceContext(
  supabase: SupabaseLike,
  user: User,
): Promise<AppWorkspaceContext> {
  let requestedWorkspaceId: string | null = null;
  try {
    const cookieStore = await cookies();
    requestedWorkspaceId = cookieStore.get("active_workspace_id")?.value ?? null;
  } catch {
    // Cookies may be inaccessible in non-request contexts
  }

  const cacheKey = `${user.id}:${requestedWorkspaceId || "default"}`;
  const cached = workspaceContextCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.context;
  }

  const [profile, workspaces] = await Promise.all([
    syncUserProfile(supabase, user),
    getOrCreateUserWorkspaces(supabase, user),
  ]);
  const activeWorkspace = await resolveActiveWorkspace(workspaces);

  const subscriptionResult = await supabase
    .from("workspace_subscriptions")
    .select("*")
    .eq("workspace_id", activeWorkspace.workspace.id)
    .single();

  if (subscriptionResult.error) {
    throw subscriptionResult.error;
  }

  const context: AppWorkspaceContext = {
    profile,
    workspace: activeWorkspace.workspace,
    membership: activeWorkspace.membership,
    workspaces,
    subscription: subscriptionResult.data as WorkspaceSubscriptionRecord,
  };

  workspaceContextCache.set(cacheKey, {
    context,
    expiresAt: Date.now() + WORKSPACE_CONTEXT_TTL_MS,
  });

  return context;
}

