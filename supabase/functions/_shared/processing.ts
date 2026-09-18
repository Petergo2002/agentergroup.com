export const MAX_EMBEDDING_CHARACTERS = 1400;
export const EMBEDDING_DIMENSIONS = 384;

export function validEmbedding(value: unknown): value is number[] {
  return Array.isArray(value) && value.length === EMBEDDING_DIMENSIONS &&
    value.every((item) => typeof item === 'number' && Number.isFinite(item)) &&
    value.some((item) => item !== 0);
}

export class ProcessingError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status = 500) {
    super(message);
    this.name = 'ProcessingError';
    this.code = code;
    this.status = status;
  }
}

export function isTransientStatus(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

/**
 * The edge runtime throws this when function-to-function calls come too fast.
 *
 * It is not a ProcessingError, not a TypeError, and its name is not in the
 * abort list, so the original retry predicate classified the one error that
 * carries its own Retry-After as permanent and gave up immediately. Ingesting a
 * 30-chunk page makes 30 worker calls, so tripping this was routine and looked
 * to the customer like scraping being unreliable.
 */
export function readRateLimitRetryMs(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const candidate = error as { name?: unknown; retryAfterMs?: unknown; status?: unknown };

  const retryAfterMs = typeof candidate.retryAfterMs === 'number' && Number.isFinite(candidate.retryAfterMs)
    ? Math.max(0, Math.round(candidate.retryAfterMs))
    : null;

  if (retryAfterMs !== null) return retryAfterMs;
  if (typeof candidate.name === 'string' && candidate.name.toLowerCase().includes('ratelimit')) return 0;
  if (candidate.status === 429) return 0;
  return null;
}

export function isRateLimitError(error: unknown) {
  return readRateLimitRetryMs(error) !== null;
}

/** True for anything a later run can reasonably get past. */
export function isTransientFailure(error: unknown) {
  if (isRateLimitError(error)) return true;
  if (error instanceof ProcessingError) return isTransientStatus(error.status);
  if (error instanceof TypeError) return true;
  return error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name);
}

export async function beforeDeadline<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let abort: () => void = () => {};
  const expired = new Promise<never>((_resolve, reject) => {
    abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
  });
  try { return await Promise.race([operation, expired]); }
  finally { signal.removeEventListener('abort', abort); }
}

/**
 * Waits, but never past the run's deadline.
 *
 * Returns false when the deadline arrives first, which tells the caller to stop
 * retrying and let the next run continue from the last checkpoint — waiting out
 * a 47-second rate limit inside a 110-second budget is often not possible, and
 * pretending otherwise just converts a resumable pause into a hard failure.
 */
async function sleepWithin(
  waitMs: number,
  sleep: (ms: number) => Promise<void>,
  signal?: AbortSignal,
): Promise<boolean> {
  if (!signal) {
    await sleep(waitMs);
    return true;
  }
  if (signal.aborted) return false;

  let onAbort: () => void = () => {};
  const aborted = new Promise<boolean>((resolve) => {
    onAbort = () => resolve(false);
    signal.addEventListener('abort', onAbort, { once: true });
  });

  try {
    return await Promise.race([sleep(waitMs).then(() => true), aborted]);
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}

export async function retryTransient<T>(
  operation: () => Promise<T>,
  {
    attempts = 3,
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
    signal,
  }: {
    attempts?: number;
    sleep?: (ms: number) => Promise<void>;
    /** The run's deadline. Never sleep past it — the caller resumes instead. */
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      // The deadline expiring is not a transient fault to retry against; it is
      // the run being over. Sleeping on it only burns the remaining budget.
      if (signal?.aborted) throw error;
      if (!isTransientFailure(error) || attempt + 1 >= attempts) throw error;

      const rateLimitMs = readRateLimitRetryMs(error);
      const backoffMs = 500 * 2 ** attempt + Math.floor(Math.random() * 250);
      // Honour the platform's own Retry-After. Backing off 0.5s against a
      // 47-second limit just spends the attempts without waiting long enough.
      const waitMs = rateLimitMs !== null ? Math.max(rateLimitMs, backoffMs) : backoffMs;

      if (!(await sleepWithin(waitMs, sleep, signal))) throw error;
    }
  }
}

export async function generateRemoteEmbedding(
  content: string,
  options: { url: string; key: string; signal?: AbortSignal; fetcher?: typeof fetch },
) {
  if (!content.trim() || content.length > MAX_EMBEDDING_CHARACTERS) {
    throw new ProcessingError('Invalid embedding input size.', 'INVALID_EMBEDDING_INPUT', 400);
  }
  return retryTransient(async () => {
    options.signal?.throwIfAborted();
    const response = await (options.fetcher ?? fetch)(`${options.url}/functions/v1/embed-knowledge-chunk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: options.key, 'x-internal-service-key': options.key },
      body: JSON.stringify({ content }),
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(15_000)])
        : AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new ProcessingError(
        `Embedding service returned HTTP ${response.status}. Saved progress can be retried.`,
        response.status === 546 ? 'EMBEDDING_WORKER_LIMIT' : 'EMBEDDING_SERVICE_ERROR',
        response.status,
      );
    }
    const result = await response.json();
    if (!validEmbedding(result.embedding)) {
      throw new ProcessingError('Embedding service returned an invalid vector.', 'INVALID_EMBEDDING', 502);
    }
    return result.embedding as number[];
  }, { signal: options.signal });
}
