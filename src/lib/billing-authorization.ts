interface BillingAuthorizationFilter<TData> {
  select: (columns: string) => BillingAuthorizationQuery<TData>;
}

interface BillingAuthorizationQuery<TData> {
  eq: (column: string, value: string) => BillingAuthorizationQuery<TData>;
  single: () => Promise<{
    data: TData | null;
    error: { message?: string } | null;
  }>;
}

export interface BillingAuthorizationClient {
  from: (table: "workspace_members") => BillingAuthorizationFilter<{
    role: string | null;
  }>;
}

export class BillingAuthorizationError extends Error {
  status = 403;

  constructor(
    message = "Unauthorized. Only workspace admins can manage billing.",
  ) {
    super(message);
    this.name = "BillingAuthorizationError";
  }
}

export function isBillingAdminRole(role: unknown) {
  return role === "owner" || role === "admin";
}

export async function assertWorkspaceBillingAdmin(
  supabase: BillingAuthorizationClient,
  workspaceId: string,
  userId: string,
) {
  const { data: memberData, error: memberError } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .single();

  if (memberError || !memberData || !isBillingAdminRole(memberData.role)) {
    throw new BillingAuthorizationError();
  }

  return memberData;
}
