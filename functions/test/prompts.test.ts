import assert from 'node:assert/strict';
import test from 'node:test';

import { hasConsent, isProActive } from '../src/lib/access.js';
import {
  buildLyricsPrompt,
  buildMusicStylePrompt,
  buildPosterPrompt,
  speechLanguageBoost,
  speechSeconds,
} from '../src/lib/prompts.js';
import { isExpiredMedia, isStuckRender } from '../src/lib/retention.js';
import { findLook, GENRES, OCCASIONS } from '../src/shared/catalog.js';
import { personalLyrics, seedFrom } from '../src/shared/lyrics.js';
import { containsBlockedTerm } from '../src/shared/validation.js';

test('poster prompts come only from the server catalog plus a subject hint', () => {
  const look = findLook('stage-star');
  assert.ok(look?.prompt);
  const prompt = buildPosterPrompt({ ...look, prompt: look.prompt }, 'pet');
  assert.ok(prompt.startsWith(look.prompt));
  assert.match(prompt, /pet animal/);
});

test('music style prompts stay within the provider limits (10–300 chars)', () => {
  for (const genre of GENRES) {
    for (const occasion of OCCASIONS) {
      const prompt = buildMusicStylePrompt(genre, occasion);
      assert.ok(prompt.length >= 10 && prompt.length <= 300);
      assert.match(prompt, /catchy 12-second hook, clear lead vocal$/);
    }
  }
});

test('personal lyrics are deterministic per idempotency key, include the name, and stay clean', () => {
  const key = '8a6f2c1e-4b3d-4e5f-9a7b-1c2d3e4f5a6b';
  for (const occasion of OCCASIONS) {
    const a = personalLyrics(occasion, 'Mia', seedFrom(key));
    assert.deepEqual(a, personalLyrics(occasion, 'Mia', seedFrom(key)));
    assert.equal(a.length, 4);
    assert.ok(a.some((line) => line.includes('Mia')));
    assert.ok(a.every((line) => !containsBlockedTerm(line)));
    const prompt = buildLyricsPrompt(a);
    assert.ok(prompt.startsWith('[Verse]\n'));
    assert.ok(prompt.length >= 10 && prompt.length <= 3000);
  }
});

test('speech language boost maps app languages to provider values', () => {
  assert.equal(speechLanguageBoost('en'), 'English');
  assert.equal(speechLanguageBoost('pt-BR'), 'Portuguese');
  assert.equal(speechLanguageBoost('zh-Hans'), 'Chinese');
  assert.equal(speechLanguageBoost('zh-HK'), 'Chinese,Yue');
  assert.equal(speechLanguageBoost('tr'), 'Turkish');
  assert.equal(speechLanguageBoost('xx'), 'auto');
});

test('voice line seconds: provider duration when present, else a clamped estimate', () => {
  assert.equal(speechSeconds('anything', 4200), 5);
  assert.equal(speechSeconds('anything', 40_000), 15);
  assert.equal(speechSeconds('Hi there', null), 2);
  assert.equal(speechSeconds('x'.repeat(280), null), 15);
  assert.equal(speechSeconds('x'.repeat(70), null), 5);
});

test('consent and entitlement gates', () => {
  assert.equal(hasConsent({ version: 1, acceptedAt: 1 }), true);
  assert.equal(hasConsent({ version: 0 }), false);
  assert.equal(hasConsent(undefined), false);
  const now = 1_000;
  assert.equal(isProActive({ pro: true, expiresAt: now + 1 }, now), true);
  assert.equal(isProActive({ pro: true, expiresAt: now - 1 }, now), false);
  assert.equal(isProActive({ pro: true, expiresAt: null }, now), true);
  assert.equal(isProActive({ pro: 'true' }, now), false);
  assert.equal(isProActive(undefined, now), false);
});

test('retention: source media older than 24 h expires; unknown ages are kept', () => {
  const now = Date.UTC(2026, 8, 26, 12);
  const ttl = 24 * 60 * 60 * 1000;
  assert.equal(isExpiredMedia(new Date(now - ttl - 1).toISOString(), now, ttl), true);
  assert.equal(isExpiredMedia(new Date(now - ttl + 60_000).toISOString(), now, ttl), false);
  assert.equal(isExpiredMedia(undefined, now, ttl), false);
  assert.equal(isExpiredMedia('not a date', now, ttl), false);
});

test('stuck renders: 30 min for queued work, longer once finalizing', () => {
  const now = 10_000_000;
  const limits = { stuckMs: 30 * 60_000, finalizingMs: 45 * 60_000 };
  assert.equal(isStuckRender({ status: 'queued', createdAt: now - 31 * 60_000, updatedAt: now }, now, limits), true);
  assert.equal(isStuckRender({ status: 'queued', createdAt: now - 29 * 60_000, updatedAt: now }, now, limits), false);
  assert.equal(isStuckRender({ status: 'finalizing', createdAt: now - 60 * 60_000, updatedAt: now - 10 * 60_000 }, now, limits), false);
  assert.equal(isStuckRender({ status: 'finalizing', createdAt: now - 60 * 60_000, updatedAt: now - 50 * 60_000 }, now, limits), true);
  assert.equal(isStuckRender({ status: 'succeeded', createdAt: 0, updatedAt: 0 }, now, limits), false);
});
