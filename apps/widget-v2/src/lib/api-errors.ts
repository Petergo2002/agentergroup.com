import type { WidgetRequestContext } from "./api";
import type { WidgetBootstrapResponse } from "../types";

export function isAbortError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

export async function createJsonError(
  response: Response,
  fallback: string,
): Promise<
  Error & { code?: string; retryAfterSeconds?: number; status?: number }
> {
  const payload = await response.json().catch(() => null);
  const retryAfterHeader = response.headers.get("Retry-After");
  const error = new Error(
    typeof payload?.error === "string" ? payload.error : fallback,
  ) as Error & { code?: string; retryAfterSeconds?: number; status?: number };
  if (typeof payload?.code === "string") {
    error.code = payload.code;
  }
  const retryAfterSeconds =
    typeof payload?.retryAfterSeconds === "number"
      ? payload.retryAfterSeconds
      : retryAfterHeader
        ? Number.parseInt(retryAfterHeader, 10)
        : null;
  if (
    typeof retryAfterSeconds === "number" &&
    Number.isFinite(retryAfterSeconds) &&
    retryAfterSeconds > 0
  ) {
    error.retryAfterSeconds = retryAfterSeconds;
  }
  error.status = response.status;
  return error;
}

export function hasErrorCode(error: unknown, code: string) {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as Error & { code?: string }).code === code
  );
}

export function getRetryAfterSeconds(error: unknown): number | null {
  if (!(error instanceof Error) || !("retryAfterSeconds" in error)) {
    return null;
  }

  const retryAfterSeconds = (
    error as Error & { retryAfterSeconds?: number }
  ).retryAfterSeconds;
  return typeof retryAfterSeconds === "number" && retryAfterSeconds > 0
    ? retryAfterSeconds
    : null;
}

export function buildRequestContextFromBootstrap(
  bootstrapContext: WidgetRequestContext,
  payload: WidgetBootstrapResponse,
): WidgetRequestContext {
  return {
    ...bootstrapContext,
    accessToken: payload.accessToken ?? null,
  };
}
