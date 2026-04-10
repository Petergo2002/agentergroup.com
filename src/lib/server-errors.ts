export interface ClientSafeErrorPayload {
  error: string;
  code: string;
}

export function createClientSafeError(
  scope: string,
  error: unknown,
  fallbackMessage: string,
  code = "INTERNAL_ERROR",
): ClientSafeErrorPayload {
  console.error(`[${scope}]`, error);
  return {
    error: fallbackMessage,
    code,
  };
}
