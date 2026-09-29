import assert from 'node:assert/strict';
import test from 'node:test';

import { DEFAULT_IMAGE_MODEL, isAllowedQueueUrl, parseQueueURL, resolveImageModel } from '../src/lib/image-model.js';
import { buildEditPayload, buildSubmitUrl, createFalProvider, falQuality, firstImageUrl } from '../src/lib/provider.js';
import { DEFAULT_RUNTIME_CONFIG, getRuntimeConfig, isCacheFresh, parseRuntimeConfig, resetRuntimeConfigCache } from '../src/lib/runtime-config.js';

test('the default model is gpt-image-2 edit on the fal queue host', () => {
  assert.equal(DEFAULT_IMAGE_MODEL.queueURL, 'https://queue.fal.run/openai/gpt-image-2/edit');
  assert.equal(DEFAULT_IMAGE_MODEL.modelId, 'openai/gpt-image-2/edit');
});

test('a configured queue URL is host-pinned: https, queue.fal.run, no credentials/port/query/fragment', () => {
  assert.equal(parseQueueURL('https://queue.fal.run/openai/gpt-image-2.5/edit/')?.modelId, 'openai/gpt-image-2.5/edit');
  for (const bad of [
    'http://queue.fal.run/openai/gpt-image-2/edit',
    'https://evil.example/openai/gpt-image-2/edit',
    'https://queue.fal.run.evil.example/x',
    'https://user:pw@queue.fal.run/x',
    'https://queue.fal.run:8443/x',
    'https://queue.fal.run/x?y=1',
    'https://queue.fal.run/x#y',
    'https://queue.fal.run/',
    'not a url',
    42,
    undefined,
  ]) {
    assert.equal(parseQueueURL(bad), undefined, String(bad));
    assert.equal(resolveImageModel(bad), DEFAULT_IMAGE_MODEL);
  }
});

test('cancel URLs are followed only on the queue host', () => {
  assert.equal(isAllowedQueueUrl('https://queue.fal.run/openai/gpt-image-2/requests/abc/cancel'), true);
  assert.equal(isAllowedQueueUrl('https://evil.example/cancel'), false);
});

test('kill switch fails open; only an explicit false disables', () => {
  assert.equal(parseRuntimeConfig(undefined).generationEnabled, true);
  assert.equal(parseRuntimeConfig({}).generationEnabled, true);
  assert.equal(parseRuntimeConfig({ generationEnabled: 'false' }).generationEnabled, true);
  assert.equal(parseRuntimeConfig({ generationEnabled: false }).generationEnabled, false);
});

test('runtime config is cached for 60 s and a failed read falls back to the last value', async () => {
  resetRuntimeConfigCache();
  let calls = 0;
  const load = async () => {
    calls += 1;
    return { generationEnabled: false };
  };
  assert.equal((await getRuntimeConfig(load, 1_000)).generationEnabled, false);
  assert.equal((await getRuntimeConfig(load, 30_000)).generationEnabled, false);
  assert.equal(calls, 1);
  const failing = async () => {
    throw new Error('offline');
  };
  assert.equal((await getRuntimeConfig(failing, 70_000)).generationEnabled, false);
  resetRuntimeConfigCache();
  assert.deepEqual(await getRuntimeConfig(failing, 0), DEFAULT_RUNTIME_CONFIG);
  assert.equal(isCacheFresh(null, 0), false);
  resetRuntimeConfigCache();
});

test('the edit payload maps quality and only includes mask_url when a mask exists', () => {
  assert.equal(falQuality('standard'), 'medium');
  assert.equal(falQuality('high'), 'high');
  const plain = buildEditPayload({ prompt: 'p', imageUrl: 'https://fal.media/a.jpg', quality: 'standard', imageSize: 'auto', outputFormat: 'jpeg' });
  assert.deepEqual(plain, { prompt: 'p', image_urls: ['https://fal.media/a.jpg'], image_size: 'auto', quality: 'medium', num_images: 1, output_format: 'jpeg' });
  assert.equal('mask_url' in plain, false);
  const masked = buildEditPayload({
    prompt: 'p',
    imageUrl: 'https://fal.media/a.png',
    quality: 'high',
    imageSize: { width: 1024, height: 1536 },
    outputFormat: 'png',
    maskUrl: 'https://fal.media/m.png',
  });
  assert.equal(masked.mask_url, 'https://fal.media/m.png');
  assert.deepEqual(masked.image_size, { width: 1024, height: 1536 });
});

test('submit URL appends the encoded webhook and refuses non-pinned hosts', () => {
  const url = buildSubmitUrl(DEFAULT_IMAGE_MODEL.queueURL, 'https://x.cloudfunctions.net/falWebhook?uid=a&t=b');
  assert.equal(url, `https://queue.fal.run/openai/gpt-image-2/edit?fal_webhook=${encodeURIComponent('https://x.cloudfunctions.net/falWebhook?uid=a&t=b')}`);
  assert.throws(() => buildSubmitUrl('https://evil.example/x', 'https://w'));
});

test('the fal provider talks only to pinned hosts with the key header (injected fetch, no network)', async () => {
  const calls: { url: string; method: string; auth: string | null }[] = [];
  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    calls.push({ url, method: init?.method ?? 'GET', auth: headers.get('authorization') });
    if (url.startsWith('https://rest.alpha.fal.ai/storage/upload/initiate')) {
      return Response.json({ upload_url: 'https://storage.fal.media/put/abc', file_url: 'https://v3.fal.media/files/abc.png' });
    }
    if (url.startsWith('https://storage.fal.media/put/')) return new Response(null, { status: 200 });
    if (url.startsWith('https://queue.fal.run/')) {
      return Response.json({ request_id: 'req-1', cancel_url: 'https://queue.fal.run/openai/gpt-image-2/requests/req-1/cancel' });
    }
    return new Response('nope', { status: 404 });
  }) as typeof fetch;
  const provider = createFalProvider('test-key', fakeFetch);
  const file = await provider.uploadImage(Buffer.from([1, 2, 3]), 'image.png', 'image/png');
  assert.equal(file, 'https://v3.fal.media/files/abc.png');
  const job = await provider.submitEdit({
    queueURL: DEFAULT_IMAGE_MODEL.queueURL,
    payload: buildEditPayload({ prompt: 'p', imageUrl: file, quality: 'standard', imageSize: 'auto', outputFormat: 'jpeg' }),
    webhookUrl: 'https://example.cloudfunctions.net/falWebhook',
  });
  assert.deepEqual(job, { requestId: 'req-1', cancelUrl: 'https://queue.fal.run/openai/gpt-image-2/requests/req-1/cancel' });
  await provider.cancel('https://evil.example/cancel'); // ignored, never fetched
  assert.equal(calls.some((c) => c.url.startsWith('https://evil.example')), false);
  // The key goes to fal API hosts only, never to the CDN PUT.
  for (const call of calls) {
    if (call.url.startsWith('https://storage.fal.media/')) assert.equal(call.auth, null);
    else assert.equal(call.auth, 'Key test-key');
  }
});

test('provider errors are typed and never carry the response body', async () => {
  const fakeFetch = (async () => new Response('flagged by content checker: <details>', { status: 422 })) as unknown as typeof fetch;
  const provider = createFalProvider('k', fakeFetch);
  await assert.rejects(
    provider.submitEdit({ queueURL: DEFAULT_IMAGE_MODEL.queueURL, payload: buildEditPayload({ prompt: 'p', imageUrl: 'u', quality: 'standard', imageSize: 'auto', outputFormat: 'jpeg' }), webhookUrl: 'https://w' }),
    (error: Error) => error.name === 'ProviderError' && !error.message.includes('details') && (error as unknown as { failure: string }).failure === 'content_blocked',
  );
  assert.throws(() => createFalProvider(''));
});

test('the first output image URL is read from a completed payload', () => {
  assert.equal(firstImageUrl({ images: [{ url: 'https://v3.fal.media/x.png' }] }), 'https://v3.fal.media/x.png');
  assert.equal(firstImageUrl({ images: [] }), null);
  assert.equal(firstImageUrl(null), null);
});
