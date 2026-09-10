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

export async function retryTransient<T>(
  operation: () => Promise<T>,
  { attempts = 3, sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)) } = {},
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const retryable = error instanceof ProcessingError
        ? isTransientStatus(error.status)
        : error instanceof TypeError || (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name));
      if (!retryable || attempt + 1 >= attempts) throw error;
      await sleep(500 * 2 ** attempt + Math.floor(Math.random() * 250));
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
  });
}
