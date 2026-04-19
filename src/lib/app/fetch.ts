/**
 * A pragmatic wrapper around fetch for internal API calls.
 * Provides default timeouts and basic error handling to prevent 
 * "zombie" requests during server-side processing.
 */

export interface InternalFetchOptions extends RequestInit {
  timeout?: number;
}

export class InternalFetchError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown
  ) {
    super(message);
    this.name = "InternalFetchError";
  }
}

export async function safeInternalFetch(
  url: string | URL,
  options: InternalFetchOptions = {}
): Promise<Response> {
  const { timeout = 10000, ...fetchOptions } = options;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });

    clearTimeout(id);

    if (!response.ok) {
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      throw new InternalFetchError(
        response.status,
        `Internal fetch failed: ${response.statusText}`,
        body
      );
    }

    return response;
  } catch (error) {
    clearTimeout(id);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Internal fetch timed out after ${timeout}ms`);
    }
    throw error;
  }
}
