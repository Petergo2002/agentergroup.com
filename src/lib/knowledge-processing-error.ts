export async function knowledgeProcessingError(error: unknown, savedMessage?: string | null) {
  const value = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const response = value.context instanceof Response ? value.context : null;
  let code: string | null = null;
  let responseMessage: string | null = null;
  if (response) {
    try {
      const body = await response.clone().json();
      if (typeof body?.code === 'string') code = body.code;
      if (typeof body?.error === 'string') responseMessage = body.error.slice(0, 2000);
    } catch { /* Gateways can return an empty or non-JSON response. */ }
  }
  const meaningfulSavedMessage = savedMessage?.trim() &&
    !savedMessage.includes('Edge Function returned a non-2xx') ? savedMessage : null;
  const message = response?.status === 546 || code === 'WORKER_LIMIT'
    ? 'Knowledge processing exceeded the server resource limit. Saved progress can be retried.'
    : meaningfulSavedMessage || responseMessage ||
      (response?.status === 401 ? 'Your session expired. Sign in again and retry.' : null) ||
      'Knowledge processing could not finish. Saved progress can be retried.';
  return { message, status: response?.status ?? null, code };
}
