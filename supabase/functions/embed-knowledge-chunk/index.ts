import { json } from '../_shared/http.ts';
import { MAX_EMBEDDING_CHARACTERS, validEmbedding } from '../_shared/processing.ts';
import { configuredServiceKeys } from '../_shared/service-auth.ts';

// Exactly one inference per request keeps CPU work isolated from ingestion.
const model = new Supabase.ai.Session('gte-small');

Deno.serve(async (request) => {
  const key = request.headers.get('x-internal-service-key');
  if (!key || !configuredServiceKeys().has(key)) return json({ error: 'Unauthorized' }, 401);
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  // A chunk needs at most 8.4KB even when every character is JSON-escaped.
  const reader = request.body?.getReader();
  if (!reader) return json({ error: 'Content is required.' }, 400);
  const parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.byteLength;
    if (size > 10_000) {
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
  const content = body?.content;
  if (typeof content !== 'string' || !content.trim() || content.length > MAX_EMBEDDING_CHARACTERS) {
    return json({ error: 'Invalid content size.' }, 400);
  }
  try {
    const embedding = await model.run(content, { mean_pool: true, normalize: true });
    if (!validEmbedding(embedding)) throw new Error('Invalid embedding vector');
    return json({ embedding });
  } catch (error) {
    console.error('[embed-knowledge-chunk] Inference failed', error);
    return json({ error: 'Embedding generation failed.', code: 'EMBEDDING_FAILED' }, 503);
  }
});
