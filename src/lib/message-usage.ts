interface MessageUsageRpcClient {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data?: unknown | null; error?: { message: string } | null }>;
}

export class MessageLimitExceededError extends Error {
  status = 402;
  code = "MESSAGE_LIMIT_REACHED";

  constructor(
    message = "You have reached your monthly message limit. Please upgrade your plan.",
  ) {
    super(message);
    this.name = "MessageLimitExceededError";
  }
}

export async function consumeWorkspaceMessageUsage(
  supabase: MessageUsageRpcClient,
  workspaceId: string,
) {
  const { data: allowed, error } = await supabase.rpc(
    "increment_workspace_message_usage",
    { p_workspace_id: workspaceId },
  );

  if (error) {
    throw new Error(error.message);
  }

  if (!allowed) {
    throw new MessageLimitExceededError();
  }
}
