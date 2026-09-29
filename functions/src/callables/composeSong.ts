/**
 * A personal original song ("a song about {name}") — Pro only, charged in
 * credits. Lyrics come from the shared original templates; MiniMax Music
 * sings them; the stored file is capped to the 15 s performance length.
 */
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { onCall } from 'firebase-functions/v2/https';

import { CLIENT_URL_TTL_MS, FAL_KEY, MAX_PROVIDER_AUDIO_BYTES, REGION } from '../config.js';
import { handleCallable } from '../lib/callable.js';
import { errorName, fail } from '../lib/errors.js';
import { capMp3Length } from '../lib/ffmpeg.js';
import { failureCodeOf, httpStatusOf } from '../lib/failures.js';
import { log } from '../lib/log.js';
import { fetchProviderMedia, signedReadUrl, uploadFile, withTempDir } from '../lib/media.js';
import { storagePaths } from '../lib/paths.js';
import { buildLyricsPrompt, buildMusicStylePrompt } from '../lib/prompts.js';
import { mediaProvider } from '../lib/provider.js';
import { beginPaidStep, completePaidStep, refundPaidStep } from '../lib/steps.js';
import { parseComposeSong } from '../lib/validate.js';
import type { ComposeSongResponse } from '../shared/api.js';
import { personalLyrics, seedFrom } from '../shared/lyrics.js';
import { clampSeconds, MAX_PERFORMANCE_SECONDS, STEP_COSTS } from '../shared/pricing.js';

const AUDIO_TYPES = /^(audio\/(mpeg|mp3)|application\/octet-stream|binary\/octet-stream)$/;

export const composeSong = onCall(
  {
    region: REGION,
    enforceAppCheck: true,
    secrets: [FAL_KEY],
    maxInstances: 10,
    timeoutSeconds: 240,
    memory: '512MiB',
  },
  handleCallable('composeSong', async (request, uid): Promise<ComposeSongResponse> => {
    const input = parseComposeSong(request.data, uid);
    // Deterministic per request: a replay (same key) yields the same lyrics.
    const lyrics = personalLyrics(input.occasion, input.name, seedFrom(input.idempotencyKey));
    const songId = randomUUID();
    const started = await beginPaidStep({
      uid,
      key: input.idempotencyKey,
      kind: 'composeSong',
      refId: songId,
      cost: STEP_COSTS.personalSong,
      useFreePosterToken: false,
      requirePro: true,
      ledgerReason: 'song',
    });
    if (started.kind === 'replay') {
      const { storagePath, seconds } = started.record.response ?? {};
      if (typeof storagePath !== 'string' || typeof seconds !== 'number') fail('unknown');
      return {
        storagePath,
        audioUrl: await signedReadUrl(storagePath, CLIENT_URL_TTL_MS),
        seconds,
        lyrics,
        balance: started.balance,
      };
    }

    try {
      const result = await mediaProvider(FAL_KEY.value()).composeMusic({
        stylePrompt: buildMusicStylePrompt(input.genre, input.occasion),
        lyricsPrompt: buildLyricsPrompt(lyrics),
      });
      const media = await fetchProviderMedia(result.audioUrl, {
        maxBytes: MAX_PROVIDER_AUDIO_BYTES,
        timeoutMs: 30_000,
        typePattern: AUDIO_TYPES,
      });
      const storagePath = storagePaths.song(uid, songId);
      const seconds = await withTempDir(async (dir) => {
        const source = join(dir, 'source.mp3');
        const capped = join(dir, 'song.mp3');
        await writeFile(source, media.buffer);
        const probe = await capMp3Length(source, capped, MAX_PERFORMANCE_SECONDS);
        await uploadFile(capped, storagePath, 'audio/mpeg');
        return clampSeconds(Math.min(probe.durationSeconds ?? MAX_PERFORMANCE_SECONDS, MAX_PERFORMANCE_SECONDS));
      });
      await completePaidStep(uid, input.idempotencyKey, { storagePath, seconds });
      log.info('song.created', { uid, seconds });
      return {
        storagePath,
        audioUrl: await signedReadUrl(storagePath, CLIENT_URL_TTL_MS),
        seconds,
        lyrics,
        balance: started.balance,
      };
    } catch (error) {
      const code = failureCodeOf(error);
      log.warn('song.failed', { uid, code, errorName: errorName(error), httpStatus: httpStatusOf(error) });
      await refundPaidStep(uid, input.idempotencyKey, code);
      return fail(code);
    }
  }),
);
