export function assertComposioToolCallRuntime({
  hasClient,
  hasSession,
  hasProvider,
  userId,
}: {
  hasClient: boolean;
  hasSession: boolean;
  hasProvider: boolean;
  userId: string;
}) {
  if (!hasClient) {
    throw new Error("COMPOSIO_API_KEY is missing.");
  }

  if (!hasSession) {
    throw new Error(`No Composio session is available for user ${userId}.`);
  }

  if (!hasProvider) {
    throw new Error("Composio provider is unavailable.");
  }
}
