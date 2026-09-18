import { json } from '../_shared/http.ts';
import {
  MAX_EMBEDDING_BATCH,
  MAX_EMBEDDING_CHARACTERS,
  validEmbedding,
} from '../_shared/processing.ts';
import { configuredServiceKeys } from '../_shared/service-auth.ts';

// Inference is still isolated from ingestion: this function does nothing but
// embed. It now accepts a small batch per request, because one call per chunk
// meant a 60-chunk page made 60 nested invocations — slow, and reliably enough
// to trip the edge runtime's per-trace rate limiter. Inferences run one after
// another so a batch costs the same CPU as the same chunks did individually,
// just without the per-request overhead.
const model = new Supabase.ai.Session('gte-small');

/** A chunk needs at most 8.4KB even when every character is JSON-escaped. */
const MAX_REQUEST_BYTES = MAX_EMBEDDING_BATCH * 8_400 + 1_024;

Deno.serve(async (request) => {
  const key = request.headers.get('x-internal-service-key');
  if (!key || !configuredServiceKeys().has(key)) return json({ error: 'Unauthorized' }, 401);
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const reader = request.body?.getReader();
  if (!reader) return json({ error: 'Content is required.' }, 400);
  const parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.byteLength;
    if (size > MAX_REQUEST_BYTES) {
      await reader.cancel();
      return json({ error: 'Request too large.' }, 413);
    }
    parts.push(next.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  let body;
  try { body = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { return json({ error: 'Invalid JSON.' }, 400); }

  // `content` stays supported so an older orchestrator keeps working through a
  // rollout where the two functions are not deployed at the same instant.
  const isBatch = Array.isArray(body?.contents);
  const contents: unknown[] = isBatch ? body.contents : [body?.content];

  if (contents.length === 0 || contents.length > MAX_EMBEDDING_BATCH) {
    return json({ error: 'Invalid batch size.' }, 400);
  }
  if (contents.some((item) =>
    typeof item !== 'string' || !item.trim() || item.length > MAX_EMBEDDING_CHARACTERS
  )) {
    return json({ error: 'Invalid content size.' }, 400);
  }

  try {
    const embeddings: number[][] = [];
    for (const content of contents as string[]) {
      const embedding = await model.run(content, { mean_pool: true, normalize: true });
      if (!validEmbedding(embedding)) throw new Error('Invalid embedding vector');
      embeddings.push(embedding);
    }

    return json(isBatch ? { embeddings } : { embedding: embeddings[0] });
  } catch (error) {
    console.error('[embed-knowledge-chunk] Inference failed', error);
    return json({ error: 'Embedding generation failed.', code: 'EMBEDDING_FAILED' }, 503);
  }
});
