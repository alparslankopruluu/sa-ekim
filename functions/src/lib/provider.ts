/**
 * fal.ai adapter behind a small typed interface (tests and the emulator can
 * swap the factory). `@fal-ai/client` is configured here only, per call, with
 * the secret value passed in at call time — never global, never client-side.
 *
 * VERIFY every endpoint id and field below against the live fal model pages
 * before launch (speech + music inputs are checked at compile time against
 * the typed schemas shipped in @fal-ai/client; the image-edit and lip-sync
 * endpoints are newer than those typings).
 */
import { createFalClient, type FalClient } from '@fal-ai/client';

import { RESOLUTION_INFO, type Resolution } from '../shared/pricing.js';
import type { SpeechLanguageBoost } from './prompts.js';

export const FAL_ENDPOINTS = {
  /** VERIFY: GPT Image 2.5 (Flare) edit. */
  posterEdit: 'openai/gpt-image-2.5/flare/edit',
  /** Typed in @fal-ai/client 1.10: input `prompt` (the text), `voice_setting`, `output_format`. */
  speech: 'fal-ai/minimax/speech-2.8-hd',
  /** Typed in @fal-ai/client 1.10: input `prompt` (style) + `lyrics_prompt`. */
  music: 'fal-ai/minimax-music/v2',
  /** VERIFY: MiniMax H3 Max lip-sync (image + audio → video), queue + webhook. */
  lipSync: 'minimax/h3-max/lip-sync/image-to-video',
} as const;

/**
 * VERIFY: the lip-sync endpoint's speech-transcription toggle. On for spoken
 * sound (recording / voice line), off for singing (library / personal songs).
 */
export const LIPSYNC_TRANSCRIPTION_FIELD = 'enable_transcription';

const POSTER_TIMEOUT_MS = 100_000;
const SPEECH_TIMEOUT_MS = 45_000;
const MUSIC_TIMEOUT_MS = 150_000;
/** Generated objects expire at fal after a day (data minimization); we copy them first. */
const OUTPUT_LIFECYCLE = { expiresIn: '1d' as const };

export interface MediaProvider {
  editPoster(input: { imageUrl: string; prompt: string }): Promise<{ imageUrl: string }>;
  synthesizeSpeech(input: {
    text: string;
    providerVoiceId: string;
    languageBoost: SpeechLanguageBoost;
  }): Promise<{ audioUrl: string; durationMs: number | null }>;
  composeMusic(input: { stylePrompt: string; lyricsPrompt: string }): Promise<{ audioUrl: string }>;
  submitLipSync(input: {
    imageUrl: string;
    audioUrl: string;
    resolution: Resolution;
    transcription: boolean;
    webhookUrl: string;
  }): Promise<{ requestId: string }>;
  cancelLipSync(requestId: string): Promise<void>;
}

export type ProviderFailure = 'content_blocked' | 'timeout' | 'provider_failed';

export class ProviderError extends Error {
  constructor(
    readonly failure: ProviderFailure,
    readonly httpStatus: number | null = null,
  ) {
    super(`provider ${failure}`);
    this.name = 'ProviderError';
  }
}

// --- pure helpers (unit-tested) -------------------------------------------

const SAFETY_PATTERN =
  /content[_ ]policy|safety[_ ]?check|nsfw|moderation|unsafe content|sensitive content|blocked by safety|prohibited content/i;

/** Bounded, never-logged text view of an arbitrary provider payload for pattern checks. */
function payloadText(value: unknown): string {
  if (typeof value === 'string') return value.slice(0, 8000);
  try {
    return (JSON.stringify(value) ?? '').slice(0, 8000);
  } catch {
    return '';
  }
}

function statusOf(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('status' in error)) return null;
  const status = (error as { status: unknown }).status;
  return typeof status === 'number' ? status : null;
}

/** Maps any provider-call failure to a public outcome; payload text never leaves this function. */
export function classifyProviderError(error: unknown): ProviderFailure {
  if (error instanceof ProviderError) return error.failure;
  if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) return 'timeout';
  const status = statusOf(error);
  if (status !== null && error && typeof error === 'object') {
    const body = 'body' in error ? (error as { body: unknown }).body : null;
    if (SAFETY_PATTERN.test(payloadText(body))) return 'content_blocked';
    if (status === 408 || status === 504) return 'timeout';
    return 'provider_failed';
  }
  if (error instanceof Error && /timed out/i.test(error.message)) return 'timeout';
  return 'provider_failed';
}

/** A webhook `status: "ERROR"` → public error code. */
export function classifyWebhookFailure(payload: unknown, error: unknown): 'content_blocked' | 'provider_failed' {
  return SAFETY_PATTERN.test(payloadText({ payload, error })) ? 'content_blocked' : 'provider_failed';
}

function objectAt(value: unknown, key: string): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  const child = (value as Record<string, unknown>)[key];
  return child && typeof child === 'object' && !Array.isArray(child) ? (child as Record<string, unknown>) : null;
}

export function firstImageUrl(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const images = (data as { images?: unknown }).images;
  const first: unknown = Array.isArray(images) ? images[0] : null;
  const url = first && typeof first === 'object' ? (first as { url?: unknown }).url : null;
  return typeof url === 'string' ? url : null;
}

export function audioUrlOf(data: unknown): string | null {
  const url = objectAt(data, 'audio')?.url;
  return typeof url === 'string' ? url : null;
}

/** VERIFY: lip-sync output shape `{ video: { url } }`. */
export function videoUrlOf(payload: unknown): string | null {
  const url = objectAt(payload, 'video')?.url;
  return typeof url === 'string' ? url : null;
}

export function durationMsOf(data: unknown): number | null {
  if (!data || typeof data !== 'object') return null;
  const value = (data as { duration_ms?: unknown }).duration_ms;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/** Input for the lip-sync job (pure, so the field mapping is unit-tested). */
export function buildLipSyncInput(input: {
  imageUrl: string;
  audioUrl: string;
  resolution: Resolution;
  transcription: boolean;
}): Record<string, unknown> {
  return {
    image_url: input.imageUrl,
    audio_url: input.audioUrl,
    resolution: RESOLUTION_INFO[input.resolution].providerValue,
    [LIPSYNC_TRANSCRIPTION_FIELD]: input.transcription,
  };
}

// --- fal implementation ------------------------------------------------------

function falClient(apiKey: string): FalClient {
  if (!apiKey) throw new ProviderError('provider_failed');
  return createFalClient({ credentials: apiKey, suppressLocalCredentialsWarning: true });
}

export function createFalProvider(apiKey: string): MediaProvider {
  return {
    async editPoster({ imageUrl, prompt }) {
      const fal = falClient(apiKey);
      const result = await fal.subscribe(FAL_ENDPOINTS.posterEdit, {
        input: {
          prompt,
          image_urls: [imageUrl],
          quality: 'medium',
          num_images: 1,
          output_format: 'png',
          image_size: 'auto',
        },
        logs: false,
        timeout: POSTER_TIMEOUT_MS,
        abortSignal: AbortSignal.timeout(POSTER_TIMEOUT_MS + 5_000),
        storageSettings: OUTPUT_LIFECYCLE,
      });
      const url = firstImageUrl(result.data);
      if (!url) throw new ProviderError('provider_failed');
      return { imageUrl: url };
    },

    async synthesizeSpeech({ text, providerVoiceId, languageBoost }) {
      const fal = falClient(apiKey);
      const result = await fal.subscribe(FAL_ENDPOINTS.speech, {
        input: {
          prompt: text,
          voice_setting: { voice_id: providerVoiceId, speed: 1, vol: 1, pitch: 0 },
          output_format: 'url',
          language_boost: languageBoost,
          audio_setting: { format: 'mp3', sample_rate: '32000', bitrate: '128000', channel: '1' },
        },
        logs: false,
        timeout: SPEECH_TIMEOUT_MS,
        abortSignal: AbortSignal.timeout(SPEECH_TIMEOUT_MS + 5_000),
        storageSettings: OUTPUT_LIFECYCLE,
      });
      const url = audioUrlOf(result.data);
      if (!url) throw new ProviderError('provider_failed');
      return { audioUrl: url, durationMs: durationMsOf(result.data) };
    },

    async composeMusic({ stylePrompt, lyricsPrompt }) {
      const fal = falClient(apiKey);
      const result = await fal.subscribe(FAL_ENDPOINTS.music, {
        input: {
          prompt: stylePrompt,
          lyrics_prompt: lyricsPrompt,
          audio_setting: { format: 'mp3', sample_rate: '44100', bitrate: '256000' },
        },
        logs: false,
        timeout: MUSIC_TIMEOUT_MS,
        abortSignal: AbortSignal.timeout(MUSIC_TIMEOUT_MS + 5_000),
        storageSettings: OUTPUT_LIFECYCLE,
      });
      const url = audioUrlOf(result.data);
      if (!url) throw new ProviderError('provider_failed');
      return { audioUrl: url };
    },

    async submitLipSync({ imageUrl, audioUrl, resolution, transcription, webhookUrl }) {
      const fal = falClient(apiKey);
      const queued = await fal.queue.submit(FAL_ENDPOINTS.lipSync, {
        input: buildLipSyncInput({ imageUrl, audioUrl, resolution, transcription }),
        webhookUrl,
        storageSettings: OUTPUT_LIFECYCLE,
        abortSignal: AbortSignal.timeout(20_000),
      });
      if (typeof queued.request_id !== 'string' || queued.request_id.length === 0) {
        throw new ProviderError('provider_failed');
      }
      return { requestId: queued.request_id };
    },

    async cancelLipSync(requestId) {
      const fal = falClient(apiKey);
      await fal.queue.cancel(FAL_ENDPOINTS.lipSync, { requestId, abortSignal: AbortSignal.timeout(10_000) });
    },
  };
}

type ProviderFactory = (apiKey: string) => MediaProvider;

let factory: ProviderFactory = createFalProvider;

export function mediaProvider(apiKey: string): MediaProvider {
  return factory(apiKey);
}

/** Test/emulator seam: swap the provider implementation (returns a restore function). */
export function setMediaProviderFactory(next: ProviderFactory): () => void {
  const previous = factory;
  factory = next;
  return () => {
    factory = previous;
  };
}
