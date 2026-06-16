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
    throw new Error("Connection provider API key is missing.");
  }

  if (!hasSession) {
    throw new Error(`No connection provider session is available for user ${userId}.`);
  }

  if (!hasProvider) {
    throw new Error("Connection provider is unavailable.");
  }
}
