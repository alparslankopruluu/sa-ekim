import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../src/lib/errors.js';
import {
  isOwnedMediaPath,
  parseCancelRender,
  parseComposeSong,
  parseCreatePoster,
  parseCreateRender,
  parseRecordConsent,
  parseSynthesizeVoice,
} from '../src/lib/validate.js';
import { findSong } from '../src/shared/catalog.js';
import { PREVIEW, renderCost } from '../src/shared/pricing.js';

const UID = 'user123';
const KEY = '8a6f2c1e-4b3d-4e5f-9a7b-1c2d3e4f5a6b';

function rejects(fn: () => unknown, code: string): void {
  assert.throws(fn, (error: unknown) => error instanceof AppError && error.code === code);
}

test('owned media paths: own prefix, allowed root, exactly root/uid/file', () => {
  assert.equal(isOwnedMediaPath(`uploads/${UID}/photo.jpg`, UID, ['uploads']), true);
  assert.equal(isOwnedMediaPath(`uploads/other/photo.jpg`, UID, ['uploads']), false);
  assert.equal(isOwnedMediaPath(`posters/${UID}/p.png`, UID, ['uploads']), false);
  assert.equal(isOwnedMediaPath(`uploads/${UID}/a/b.jpg`, UID, ['uploads']), false);
  assert.equal(isOwnedMediaPath(`uploads/${UID}/../x.jpg`, UID, ['uploads']), false);
  assert.equal(isOwnedMediaPath(42, UID, ['uploads']), false);
});

test('recordConsent: integer version ≥ 1', () => {
  assert.deepEqual(parseRecordConsent({ version: 1 }), { version: 1 });
  rejects(() => parseRecordConsent({ version: 0 }), 'invalid_input');
  rejects(() => parseRecordConsent({ version: 1.5 }), 'invalid_input');
  rejects(() => parseRecordConsent(null), 'invalid_input');
});

test('createPoster: owned upload, a real non-original look, a subject', () => {
  const ok = parseCreatePoster(
    { idempotencyKey: KEY.toUpperCase(), photoPath: `uploads/${UID}/me.jpg`, lookId: 'rock-legend', subject: 'pet' },
    UID,
  );
  assert.equal(ok.idempotencyKey, KEY);
  assert.equal(ok.look.id, 'rock-legend');
  assert.equal(ok.look.proOnly, true);
  assert.equal(ok.useFreePosterToken, false);
  const base = { idempotencyKey: KEY, photoPath: `uploads/${UID}/me.jpg`, lookId: 'stage-star', subject: 'person' };
  rejects(() => parseCreatePoster({ ...base, lookId: 'original' }, UID), 'invalid_input');
  rejects(() => parseCreatePoster({ ...base, lookId: 'nope' }, UID), 'invalid_input');
  rejects(() => parseCreatePoster({ ...base, photoPath: `uploads/other/me.jpg` }, UID), 'invalid_input');
  rejects(() => parseCreatePoster({ ...base, subject: 'robot' }, UID), 'invalid_input');
  rejects(() => parseCreatePoster({ ...base, idempotencyKey: 'not-a-uuid' }, UID), 'invalid_input');
  rejects(() => parseCreatePoster({ ...base, useFreePosterToken: 'yes' }, UID), 'invalid_input');
});

test('synthesizeVoice: shared text rules, known voice, language tag', () => {
  const ok = parseSynthesizeVoice({ idempotencyKey: KEY, text: '  Happy birthday!  ', voiceId: 'bright', language: 'pt-BR' }, UID);
  assert.equal(ok.text, 'Happy birthday!');
  assert.equal(ok.voice.providerVoiceId, 'Lively_Girl');
  const base = { idempotencyKey: KEY, text: 'Hello there', voiceId: 'bright', language: 'en' };
  rejects(() => parseSynthesizeVoice({ ...base, text: 'hi' }, UID), 'invalid_input');
  rejects(() => parseSynthesizeVoice({ ...base, text: 'x'.repeat(281) }, UID), 'invalid_input');
  rejects(() => parseSynthesizeVoice({ ...base, text: 'you are a nazi' }, UID), 'content_blocked');
  rejects(() => parseSynthesizeVoice({ ...base, voiceId: 'nope' }, UID), 'invalid_input');
  rejects(() => parseSynthesizeVoice({ ...base, language: 'english please' }, UID), 'invalid_input');
});

test('composeSong: a name (not a prompt), known occasion and genre', () => {
  const ok = parseComposeSong(
    { idempotencyKey: KEY, name: "  Zoë   O'Neil ", occasion: 'birthday', genre: 'pop', language: 'en' },
    UID,
  );
  assert.equal(ok.name, "Zoë O'Neil");
  const base = { idempotencyKey: KEY, name: 'Mia', occasion: 'birthday', genre: 'pop', language: 'en' };
  rejects(() => parseComposeSong({ ...base, name: '' }, UID), 'invalid_input');
  rejects(() => parseComposeSong({ ...base, name: 'x'.repeat(25) }, UID), 'invalid_input');
  rejects(() => parseComposeSong({ ...base, name: 'Mia; sing about' }, UID), 'content_blocked');
  rejects(() => parseComposeSong({ ...base, occasion: 'wedding' }, UID), 'invalid_input');
  rejects(() => parseComposeSong({ ...base, genre: 'metal' }, UID), 'invalid_input');
});

const renderBase = {
  idempotencyKey: KEY,
  imagePath: `uploads/${UID}/me.jpg`,
  sound: { kind: 'song', songId: 'main-character' },
  resolution: '768p',
  purpose: 'full',
  lookId: 'stage-star',
};

test('createRender: library song → catalog audio + catalog lyrics, singing (no transcription)', () => {
  const plan = parseCreateRender(renderBase, UID);
  assert.equal(plan.audioSourcePath, 'catalog/songs/main-character.mp3');
  assert.equal(plan.soundPath, null);
  assert.deepEqual(plan.captions, findSong('main-character')?.lyrics);
  assert.equal(plan.transcription, false);
  assert.equal(plan.reservedCredits, renderCost('768p', 15));
  assert.equal(plan.requiresPro, false);
});

test('createRender: user sounds map to their roots, captions validated, transcription for speech', () => {
  const recording = parseCreateRender(
    { ...renderBase, sound: { kind: 'recording', storagePath: `uploads/${UID}/rec.m4a`, seconds: 9 }, captions: ['ignored'] },
    UID,
  );
  assert.equal(recording.soundPath, `uploads/${UID}/rec.m4a`);
  assert.deepEqual(recording.captions, []);
  assert.equal(recording.transcription, true);

  const voice = parseCreateRender(
    { ...renderBase, sound: { kind: 'voice', storagePath: `voices/${UID}/v.mp3`, seconds: 4 }, captions: [' Hello! '] },
    UID,
  );
  assert.deepEqual(voice.captions, ['Hello!']);
  assert.equal(voice.transcription, true);

  const song = parseCreateRender(
    {
      ...renderBase,
      sound: { kind: 'personalSong', storagePath: `songs/${UID}/s.mp3`, seconds: 12 },
      captions: ['a', 'b', 'c', 'd', 'e'],
    },
    UID,
  );
  assert.deepEqual(song.captions, []); // five lines fail checkCaptions → none
  assert.equal(song.transcription, false);

  rejects(
    () => parseCreateRender({ ...renderBase, sound: { kind: 'voice', storagePath: `uploads/${UID}/v.mp3`, seconds: 4 } }, UID),
    'invalid_input',
  );
  rejects(
    () => parseCreateRender({ ...renderBase, sound: { kind: 'recording', storagePath: `uploads/${UID}/r.m4a`, seconds: 16 } }, UID),
    'invalid_input',
  );
  rejects(
    () => parseCreateRender({ ...renderBase, sound: { kind: 'recording', storagePath: `uploads/${UID}/r.m4a`, seconds: 1 } }, UID),
    'invalid_input',
  );
});

test('createRender: resolutions, Pro gate and the hdBoost token', () => {
  assert.equal(parseCreateRender({ ...renderBase, resolution: '1080p' }, UID).requiresPro, true);
  assert.equal(parseCreateRender({ ...renderBase, resolution: '2k' }, UID).requiresPro, true);
  const boosted = parseCreateRender({ ...renderBase, useHdBoostToken: true }, UID);
  assert.equal(boosted.renderResolution, '1080p');
  assert.equal(boosted.billingResolution, '768p');
  assert.equal(boosted.requiresPro, false);
  assert.equal(boosted.reservedCredits, renderCost('768p', 15));
  rejects(() => parseCreateRender({ ...renderBase, resolution: '480p', useHdBoostToken: true }, UID), 'invalid_input');
  rejects(() => parseCreateRender({ ...renderBase, resolution: '4k' }, UID), 'invalid_input');
});

test('createRender: previews are forced to the free preview shape', () => {
  const plan = parseCreateRender({ ...renderBase, purpose: 'preview', resolution: '2k', useHdBoostToken: true }, UID);
  assert.equal(plan.renderResolution, PREVIEW.resolution);
  assert.equal(plan.reservedCredits, 0);
  assert.equal(plan.trimToSeconds, PREVIEW.seconds);
  assert.equal(plan.requiresPro, false);
  assert.equal(plan.useHdBoostToken, false);
});

test('createRender: image must be an owned upload or poster; look must exist', () => {
  assert.equal(parseCreateRender({ ...renderBase, imagePath: `posters/${UID}/p.png` }, UID).imagePath, `posters/${UID}/p.png`);
  rejects(() => parseCreateRender({ ...renderBase, imagePath: `voices/${UID}/p.png` }, UID), 'invalid_input');
  rejects(() => parseCreateRender({ ...renderBase, imagePath: `uploads/other/p.png` }, UID), 'invalid_input');
  rejects(() => parseCreateRender({ ...renderBase, lookId: 'nope' }, UID), 'invalid_input');
  rejects(() => parseCreateRender({ ...renderBase, purpose: 'draft' }, UID), 'invalid_input');
  rejects(() => parseCreateRender({ ...renderBase, sound: { kind: 'song', songId: 'unknown' } }, UID), 'invalid_input');
});

test('cancelRender: a render id (uuid)', () => {
  assert.deepEqual(parseCancelRender({ renderId: KEY }), { renderId: KEY });
  rejects(() => parseCancelRender({ renderId: '../../x' }), 'invalid_input');
});

test('deleteRender and reportRender accept only a render uuid and a fixed reason', async () => {
  const { parseDeleteRender, parseReportRender } = await import('../src/lib/validate.js');
  const id = '0b8f4e5a-3c1d-4e2f-9a7b-1c2d3e4f5a6b';
  assert.deepEqual(parseDeleteRender({ renderId: id.toUpperCase() }), { renderId: id });
  assert.deepEqual(parseReportRender({ renderId: id, reason: 'impersonation' }), { renderId: id, reason: 'impersonation' });
  assert.throws(() => parseDeleteRender({ renderId: '../other' }));
  assert.throws(() => parseReportRender({ renderId: id, reason: 'free text is not a reason' }));
  assert.throws(() => parseReportRender({ renderId: id }));
});
