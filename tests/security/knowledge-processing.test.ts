import assert from 'node:assert/strict';
import test from 'node:test';
import { chunkKnowledgeText } from '../../supabase/functions/_shared/knowledge.ts';
import { beforeDeadline, generateRemoteEmbedding, ProcessingError, retryTransient, validEmbedding } from '../../supabase/functions/_shared/processing.ts';
import { knowledgeProcessingError } from '../../src/lib/knowledge-processing-error.ts';

test('chunking bounds long sentences and preserves short trailing facts', () => {
  const text = `${'a'.repeat(9000)}. Short sentence.\n\n${'b'.repeat(1250)}FINAL_FACT`;
  const chunks = chunkKnowledgeText(text);
  assert.ok(chunks.length > 8);
  assert.ok(chunks.every((chunk, index) => chunk.content.length <= 1200 && chunk.chunkIndex === index));
  assert.ok(chunks.some((chunk) => chunk.content.includes('FINAL_FACT')));
  assert.ok(chunks.some((chunk) => chunk.content.includes('Short sentence.')));
  assert.deepEqual(chunkKnowledgeText('  '), []);
  assert.equal(chunkKnowledgeText('A short fact.')[0].content, 'A short fact.');
});

test('transient failures back off and stop after a bounded number of attempts', async () => {
  const delays: number[] = [];
  let calls = 0;
  const result = await retryTransient(async () => {
    if (++calls < 3) throw new ProcessingError('rate limited', 'RATE_LIMIT', 429);
    return 'ok';
  }, { sleep: async (ms) => { delays.push(ms); } });
  assert.equal(result, 'ok');
  assert.equal(calls, 3);
  assert.equal(delays.length, 2);
  assert.ok(delays[1] > delays[0]);
  calls = 0;
  await assert.rejects(retryTransient(async () => {
    calls++;
    throw new ProcessingError('down', 'UNAVAILABLE', 503);
  }, { sleep: async () => {} }), /down/);
  assert.equal(calls, 3);
});

test('permanent errors do not consume retries', async () => {
  for (const status of [400, 401, 402, 403, 404, 422]) {
    let calls = 0;
    await assert.rejects(retryTransient(async () => {
      calls++;
      throw new ProcessingError('permanent', 'INVALID', status);
    }, { sleep: async () => {} }), /permanent/);
    assert.equal(calls, 1);
  }
});

test('inference is a bounded batch per authenticated remote request', async () => {
  // The wire shape is now a batch — one call per chunk made a 60-chunk page
  // take 111 seconds and trip the per-trace rate limiter. Everything this test
  // guards is unchanged: the endpoint, the service-key header, an abort signal,
  // and a hard bound on what may be sent.
  let calls = 0;
  const embedding = Array.from({ length: 384 }, () => 0.05);
  const result = await generateRemoteEmbedding('saved text', {
    url: 'https://example.test', key: 'test-service-key',
    fetcher: async (url, options) => {
      calls++;
      assert.equal(url, 'https://example.test/functions/v1/embed-knowledge-chunk');
      assert.deepEqual(JSON.parse(String(options?.body)), { contents: ['saved text'] });
      assert.equal(new Headers(options?.headers).get('x-internal-service-key'), 'test-service-key');
      assert.ok(options?.signal);
      return Response.json({ embeddings: [embedding] });
    },
  });
  assert.deepEqual(result, embedding);
  assert.equal(calls, 1);
  await assert.rejects(generateRemoteEmbedding('a'.repeat(1401), {
    url: 'https://example.test', key: 'test', fetcher: async () => { throw new Error('should not fetch'); },
  }), /input size/);
});

test('invalid vectors cannot be checkpointed as successful embeddings', () => {
  assert.equal(validEmbedding([0.1]), false);
  assert.equal(validEmbedding(Array(384).fill(0)), false);
  assert.equal(validEmbedding(Array(384).fill(NaN)), false);
  assert.equal(validEmbedding(Array(384).fill('0.1')), false);
  assert.equal(validEmbedding(Array(384).fill(0.1)), true);
});

test('a stuck scraper yields to the overall processing deadline', async () => {
  const controller = new AbortController();
  const work = beforeDeadline(new Promise(() => {}), controller.signal);
  controller.abort(new Error('deadline exceeded'));
  await assert.rejects(work, /deadline exceeded/);
});

test('function error details replace the generic SDK error, including worker shutdowns', async () => {
  const failure = await knowledgeProcessingError({
    message: 'Edge Function returned a non-2xx status code',
    context: Response.json({ code: 'WORKER_LIMIT', message: 'Worker exceeded resource limits' }, { status: 546 }),
  }, 'Edge Function returned a non-2xx status code');
  assert.match(failure.message, /resource limit/);
  assert.equal(failure.status, 546);
  const pageFailure = await knowledgeProcessingError({
    context: Response.json({ code: 'WEBSITE_PAGES_FAILED', error: 'Could not scrape 1 of 3 selected pages.' }, { status: 422 }),
  });
  assert.match(pageFailure.message, /1 of 3/);
  assert.equal(pageFailure.code, 'WEBSITE_PAGES_FAILED');
  assert.match((await knowledgeProcessingError({ context: new Response('gateway error', { status: 502 }) })).message, /retried/);
});
