/** Turns one typed line into speech (MiniMax Speech HD) for a talking performance. */
import { randomUUID } from 'node:crypto';

import { onCall } from 'firebase-functions/v2/https';

import { CLIENT_URL_TTL_MS, FAL_KEY, MAX_PROVIDER_AUDIO_BYTES, REGION } from '../config.js';
import { handleCallable } from '../lib/callable.js';
import { errorName, fail } from '../lib/errors.js';
import { failureCodeOf, httpStatusOf } from '../lib/failures.js';
import { log } from '../lib/log.js';
import { fetchProviderMedia, saveBuffer, signedReadUrl } from '../lib/media.js';
import { storagePaths } from '../lib/paths.js';
import { speechLanguageBoost, speechSeconds } from '../lib/prompts.js';
import { mediaProvider } from '../lib/provider.js';
import { beginPaidStep, completePaidStep, refundPaidStep } from '../lib/steps.js';
import { parseSynthesizeVoice } from '../lib/validate.js';
import type { SynthesizeVoiceResponse } from '../shared/api.js';
import { STEP_COSTS } from '../shared/pricing.js';

const AUDIO_TYPES = /^(audio\/(mpeg|mp3)|application\/octet-stream|binary\/octet-stream)$/;

export const synthesizeVoice = onCall(
  {
    region: REGION,
    enforceAppCheck: true,
    secrets: [FAL_KEY],
    maxInstances: 20,
    timeoutSeconds: 90,
    memory: '256MiB',
  },
  handleCallable('synthesizeVoice', async (request, uid): Promise<SynthesizeVoiceResponse> => {
    const input = parseSynthesizeVoice(request.data, uid);
    const voiceId = randomUUID();
    const started = await beginPaidStep({
      uid,
      key: input.idempotencyKey,
      kind: 'synthesizeVoice',
      refId: voiceId,
      cost: STEP_COSTS.voiceLine,
      useFreePosterToken: false,
      requirePro: false,
      ledgerReason: 'voice',
    });
    if (started.kind === 'replay') {
      const { storagePath, seconds } = started.record.response ?? {};
      if (typeof storagePath !== 'string' || typeof seconds !== 'number') fail('unknown');
      return {
        storagePath,
        audioUrl: await signedReadUrl(storagePath, CLIENT_URL_TTL_MS),
        seconds,
        balance: started.balance,
      };
    }

    try {
      const result = await mediaProvider(FAL_KEY.value()).synthesizeSpeech({
        text: input.text,
        providerVoiceId: input.voice.providerVoiceId,
        languageBoost: speechLanguageBoost(input.language),
      });
      const media = await fetchProviderMedia(result.audioUrl, {
        maxBytes: MAX_PROVIDER_AUDIO_BYTES,
        timeoutMs: 20_000,
        typePattern: AUDIO_TYPES,
      });
      const storagePath = storagePaths.voice(uid, voiceId);
      await saveBuffer(storagePath, media.buffer, 'audio/mpeg');
      const seconds = speechSeconds(input.text, result.durationMs);
      await completePaidStep(uid, input.idempotencyKey, { storagePath, seconds });
      log.info('voice.created', { uid, seconds });
      return {
        storagePath,
        audioUrl: await signedReadUrl(storagePath, CLIENT_URL_TTL_MS),
        seconds,
        balance: started.balance,
      };
    } catch (error) {
      const code = failureCodeOf(error);
      log.warn('voice.failed', { uid, code, errorName: errorName(error), httpStatus: httpStatusOf(error) });
      await refundPaidStep(uid, input.idempotencyKey, code);
      return fail(code);
    }
  }),
);
