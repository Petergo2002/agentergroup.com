export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export function buildClientSafeError(
  scope: string,
  error: unknown,
  fallbackMessage: string,
  code = "INTERNAL_ERROR",
) {
  console.error(`[${scope}]`, error);
  return {
    error: fallbackMessage,
    code,
  };
}
