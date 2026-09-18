export const MAX_EMBEDDING_CHARACTERS = 1400;
export const EMBEDDING_DIMENSIONS = 384;
/**
 * Chunks embedded per worker request.
 *
 * One call per chunk made a 60-chunk page take 111 seconds and trip the
 * per-trace rate limiter. Batching cuts the nested calls that cause both.
 *
 * Four is measured, not guessed: against the live worker, batches of 1-4
 * returned 200 (4 chunks in ~2.0s) while 6 and 8 returned HTTP 546 — the
 * worker's own CPU ceiling, which is why the single-inference design existed in
 * the first place. Four leaves headroom under that ceiling, and
 * `embedWithWorkerLimitFallback` handles the case where even it is too much.
 */
export const MAX_EMBEDDING_BATCH = 4;

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

/**
 * Whether re-sending the identical request could succeed.
 *
 * The worker's CPU ceiling is recoverable but not by repetition: the same
 * chunks cost the same CPU next time. Retrying it three times only spends the
 * budget before the caller can split the batch, which is the thing that
 * actually helps. It stays transient for resume purposes.
 */
export function shouldRetrySameRequest(error: unknown) {
  if (error instanceof ProcessingError && error.code === 'EMBEDDING_WORKER_LIMIT') {
    return false;
  }
  return isTransientFailure(error);
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
      if (!shouldRetrySameRequest(error) || attempt + 1 >= attempts) throw error;

      const rateLimitMs = readRateLimitRetryMs(error);
      const backoffMs = 500 * 2 ** attempt + Math.floor(Math.random() * 250);
      // Honour the platform's own Retry-After. Backing off 0.5s against a
      // 47-second limit just spends the attempts without waiting long enough.
      const waitMs = rateLimitMs !== null ? Math.max(rateLimitMs, backoffMs) : backoffMs;

      if (!(await sleepWithin(waitMs, sleep, signal))) throw error;
    }
  }
}

interface EmbeddingCallOptions {
  url: string;
  key: string;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
}

/** Embeds a batch in one worker round trip, in the order given. */
export async function generateRemoteEmbeddings(
  contents: string[],
  options: EmbeddingCallOptions,
): Promise<number[][]> {
  if (contents.length === 0 || contents.length > MAX_EMBEDDING_BATCH) {
    throw new ProcessingError('Invalid embedding batch size.', 'INVALID_EMBEDDING_INPUT', 400);
  }
  if (contents.some((content) => !content.trim() || content.length > MAX_EMBEDDING_CHARACTERS)) {
    throw new ProcessingError('Invalid embedding input size.', 'INVALID_EMBEDDING_INPUT', 400);
  }

  return retryTransient(async () => {
    options.signal?.throwIfAborted();
    const response = await (options.fetcher ?? fetch)(`${options.url}/functions/v1/embed-knowledge-chunk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: options.key, 'x-internal-service-key': options.key },
      body: JSON.stringify({ contents }),
      // A batch does more work per call, so it gets proportionally longer.
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(30_000)])
        : AbortSignal.timeout(30_000),
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
    const embeddings = result?.embeddings;
    if (!Array.isArray(embeddings) || embeddings.length !== contents.length
      || !embeddings.every((embedding) => validEmbedding(embedding))) {
      throw new ProcessingError('Embedding service returned an invalid vector.', 'INVALID_EMBEDDING', 502);
    }
    return embeddings as number[][];
  }, { signal: options.signal });
}

export async function generateRemoteEmbedding(content: string, options: EmbeddingCallOptions) {
  const [embedding] = await generateRemoteEmbeddings([content], options);
  return embedding;
}

/**
 * Embeds a batch, halving it if the worker reports its CPU ceiling.
 *
 * Chunk cost varies with content, so no fixed batch size is safe for every
 * page. Rather than pausing the whole source on an HTTP 546, the batch splits
 * and retries: worst case it degrades to one chunk per call, which is exactly
 * the behaviour this replaced, so it can never be slower than before.
 */
export async function embedWithWorkerLimitFallback(
  contents: string[],
  options: EmbeddingCallOptions,
): Promise<number[][]> {
  try {
    return await generateRemoteEmbeddings(contents, options);
  } catch (error) {
    const hitWorkerLimit = error instanceof ProcessingError
      && error.code === 'EMBEDDING_WORKER_LIMIT';

    if (!hitWorkerLimit || contents.length === 1) throw error;

    const half = Math.ceil(contents.length / 2);
    console.warn(`[embedding] Worker limit at batch ${contents.length}; splitting to ${half}.`);
    return [
      ...(await embedWithWorkerLimitFallback(contents.slice(0, half), options)),
      ...(await embedWithWorkerLimitFallback(contents.slice(half), options)),
    ];
  }
}
