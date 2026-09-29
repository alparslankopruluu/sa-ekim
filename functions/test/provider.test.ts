import assert from 'node:assert/strict';
import test from 'node:test';

import { isAllowedAudio, isAllowedImage, isAllowedProviderUrl } from '../src/lib/media-policy.js';
import {
  audioUrlOf,
  buildLipSyncInput,
  classifyProviderError,
  classifyWebhookFailure,
  durationMsOf,
  firstImageUrl,
  LIPSYNC_TRANSCRIPTION_FIELD,
  ProviderError,
  videoUrlOf,
} from '../src/lib/provider.js';

test('provider errors map to sanitized public outcomes', () => {
  const contentPolicy = {
    status: 422,
    body: { detail: [{ loc: ['body', 'prompt'], msg: 'flagged', type: 'content_policy_violation' }] },
  };
  assert.equal(classifyProviderError(contentPolicy), 'content_blocked');
  assert.equal(classifyProviderError({ status: 500, body: { detail: 'Internal error' } }), 'provider_failed');
  assert.equal(classifyProviderError({ status: 504, body: null }), 'timeout');
  assert.equal(classifyProviderError(new Error('Client timed out waiting for the request to complete after 1000ms')), 'timeout');
  const abort = new Error('aborted');
  abort.name = 'TimeoutError';
  assert.equal(classifyProviderError(abort), 'timeout');
  assert.equal(classifyProviderError(new ProviderError('content_blocked')), 'content_blocked');
  assert.equal(classifyProviderError('weird'), 'provider_failed');
});

test('webhook errors: safety blocks vs generic failures', () => {
  assert.equal(classifyWebhookFailure({ detail: [{ type: 'content_policy_violation' }] }, 'Unprocessable'), 'content_blocked');
  assert.equal(classifyWebhookFailure(null, 'NSFW content detected'), 'content_blocked');
  assert.equal(classifyWebhookFailure({ detail: 'GPU exploded' }, 'Internal Server Error'), 'provider_failed');
});

test('output extraction is defensive', () => {
  assert.equal(firstImageUrl({ images: [{ url: 'https://v3.fal.media/a.png' }] }), 'https://v3.fal.media/a.png');
  assert.equal(firstImageUrl({ images: [] }), null);
  assert.equal(audioUrlOf({ audio: { url: 'https://v3.fal.media/a.mp3' } }), 'https://v3.fal.media/a.mp3');
  assert.equal(audioUrlOf({ audio: 'nope' }), null);
  assert.equal(videoUrlOf({ video: { url: 'https://v3.fal.media/a.mp4' } }), 'https://v3.fal.media/a.mp4');
  assert.equal(videoUrlOf(undefined), null);
  assert.equal(durationMsOf({ duration_ms: 4200 }), 4200);
  assert.equal(durationMsOf({ duration_ms: -1 }), null);
});

test('lip-sync input: provider resolution value and transcription toggle', () => {
  const speech = buildLipSyncInput({ imageUrl: 'i', audioUrl: 'a', resolution: '1080p', transcription: true });
  assert.deepEqual(speech, { image_url: 'i', audio_url: 'a', resolution: '1080p', [LIPSYNC_TRANSCRIPTION_FIELD]: true });
  const singing = buildLipSyncInput({ imageUrl: 'i', audioUrl: 'a', resolution: '480p', transcription: false });
  assert.equal(singing[LIPSYNC_TRANSCRIPTION_FIELD], false);
});

test('provider media URLs: https fal/GCS hosts only', () => {
  assert.equal(isAllowedProviderUrl('https://v3.fal.media/files/x.mp4'), true);
  assert.equal(isAllowedProviderUrl('https://fal.media/files/x.mp4'), true);
  assert.equal(isAllowedProviderUrl('https://storage.googleapis.com/b/x.mp4'), true);
  assert.equal(isAllowedProviderUrl('http://v3.fal.media/files/x.mp4'), false);
  assert.equal(isAllowedProviderUrl('https://evilfal.media/x.mp4'), false);
  assert.equal(isAllowedProviderUrl('https://fal.media.evil.com/x.mp4'), false);
  assert.equal(isAllowedProviderUrl('https://user:pw@v3.fal.media/x.mp4'), false);
  assert.equal(isAllowedProviderUrl('https://v3.fal.media:8443/x.mp4'), false);
  assert.equal(isAllowedProviderUrl('https://169.254.169.254/latest'), false);
  assert.equal(isAllowedProviderUrl(null), false);
});

test('upload policy mirrors storage.rules', () => {
  assert.equal(isAllowedImage('image/jpeg', 2_000_000), true);
  assert.equal(isAllowedImage('image/heic', 2_000_000), false);
  assert.equal(isAllowedImage('image/svg+xml', 2_000), false);
  assert.equal(isAllowedImage('image/png', 11 * 1024 * 1024), false);
  assert.equal(isAllowedAudio('audio/mp4', 3_000_000), true);
  assert.equal(isAllowedAudio('audio/mpeg', 9 * 1024 * 1024), false);
  assert.equal(isAllowedAudio('video/mp4', 1000), false);
});
