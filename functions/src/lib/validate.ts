/**
 * Pure request parsers for every callable. They run before any credit is
 * reserved, re-apply the shared client validators (the server is the
 * authority), and turn a request into a fully resolved plan.
 */
import { REPORT_REASONS, type ReportReason, type SoundSource } from '../shared/api.js';
import {
  findLook,
  findSong,
  findVoice,
  GENRES,
  type Genre,
  type LookDef,
  OCCASIONS,
  type Occasion,
  type SubjectKind,
  type VoiceDef,
} from '../shared/catalog.js';
import {
  MAX_PERFORMANCE_SECONDS,
  MIN_PERFORMANCE_SECONDS,
  PREVIEW,
  RESOLUTION_INFO,
  RESOLUTIONS,
  type Resolution,
} from '../shared/pricing.js';
import {
  checkCaptions,
  checkSongName,
  checkVoiceText,
  isIdempotencyKey,
  isOwnedPath,
  type TextVerdict,
} from '../shared/validation.js';
import { fail } from './errors.js';
import { renderReservation } from './ledger.js';
import { storagePaths, UUID_PATTERN } from './paths.js';

type Data = Record<string, unknown>;

function asObject(data: unknown): Data {
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail('invalid_input');
  return data as Data;
}

function idempotencyKeyOf(d: Data): string {
  const key = d.idempotencyKey;
  if (!isIdempotencyKey(key)) fail('invalid_input');
  return key.toLowerCase();
}

function optionalBoolean(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value !== 'boolean') fail('invalid_input');
  return value;
}

function failVerdict(verdict: Exclude<TextVerdict, 'ok'>): never {
  fail(verdict === 'blocked' ? 'content_blocked' : 'invalid_input');
}

/** BCP-47-ish language tag (the app sends its UI language, e.g. `en`, `pt-BR`, `zh-Hans`). */
const LANGUAGE_PATTERN = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8}){0,3}$/;

function languageOf(value: unknown): string {
  if (typeof value !== 'string' || value.length > 35 || !LANGUAGE_PATTERN.test(value)) fail('invalid_input');
  return value;
}

/**
 * `isOwnedPath` plus two server-side tightenings: exactly `root/uid/file`
 * (no deeper segments) and a root allowed for this particular use.
 */
export function isOwnedMediaPath(path: unknown, uid: string, roots: readonly string[]): path is string {
  if (typeof path !== 'string' || path.length > 300) return false;
  const parts = path.split('/');
  return parts.length === 3 && roots.includes(parts[0] ?? '') && isOwnedPath(path, uid);
}

// ---------------------------------------------------------------------------

export function parseRecordConsent(data: unknown): { version: number } {
  const d = asObject(data);
  const version = d.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1 || version > 1000) {
    fail('invalid_input');
  }
  return { version };
}

export interface PosterInput {
  idempotencyKey: string;
  photoPath: string;
  look: LookDef & { prompt: string };
  subject: SubjectKind;
  useFreePosterToken: boolean;
}

const SUBJECTS: readonly SubjectKind[] = ['person', 'pet', 'drawing'];

export function parseCreatePoster(data: unknown, uid: string): PosterInput {
  const d = asObject(data);
  const idempotencyKey = idempotencyKeyOf(d);
  if (!isOwnedMediaPath(d.photoPath, uid, ['uploads'])) fail('invalid_input');
  const look = typeof d.lookId === 'string' ? findLook(d.lookId) : undefined;
  // `original` keeps the photo as-is: there is nothing to generate or charge.
  if (!look || look.prompt === null) fail('invalid_input');
  if (!SUBJECTS.includes(d.subject as SubjectKind)) fail('invalid_input');
  return {
    idempotencyKey,
    photoPath: d.photoPath,
    look: { ...look, prompt: look.prompt },
    subject: d.subject as SubjectKind,
    useFreePosterToken: optionalBoolean(d.useFreePosterToken),
  };
}

export interface VoiceInput {
  idempotencyKey: string;
  text: string;
  voice: VoiceDef;
  language: string;
}

export function parseSynthesizeVoice(data: unknown, _uid: string): VoiceInput {
  const d = asObject(data);
  const idempotencyKey = idempotencyKeyOf(d);
  if (typeof d.text !== 'string') fail('invalid_input');
  const verdict = checkVoiceText(d.text);
  if (verdict !== 'ok') failVerdict(verdict);
  const voice = typeof d.voiceId === 'string' ? findVoice(d.voiceId) : undefined;
  if (!voice) fail('invalid_input');
  return { idempotencyKey, text: d.text.trim(), voice, language: languageOf(d.language) };
}

export interface SongInput {
  idempotencyKey: string;
  name: string;
  occasion: Occasion;
  genre: Genre;
  language: string;
}

export function parseComposeSong(data: unknown, _uid: string): SongInput {
  const d = asObject(data);
  const idempotencyKey = idempotencyKeyOf(d);
  if (typeof d.name !== 'string') fail('invalid_input');
  const verdict = checkSongName(d.name);
  if (verdict !== 'ok') failVerdict(verdict);
  if (!OCCASIONS.includes(d.occasion as Occasion)) fail('invalid_input');
  if (!GENRES.includes(d.genre as Genre)) fail('invalid_input');
  return {
    idempotencyKey,
    name: d.name.trim().replace(/\s+/g, ' '),
    occasion: d.occasion as Occasion,
    genre: d.genre as Genre,
    language: languageOf(d.language),
  };
}

export interface RenderPlan {
  idempotencyKey: string;
  imagePath: string;
  lookId: string;
  purpose: 'preview' | 'full';
  /** Resolution the provider renders (and the RenderDoc shows). */
  renderResolution: Resolution;
  /** Resolution the credits are priced at (768p for an HD-boost render). */
  billingResolution: Resolution;
  requiresPro: boolean;
  useHdBoostToken: boolean;
  reservedCredits: number;
  soundKind: SoundSource['kind'];
  songId: string | null;
  /** The user's own sound (RenderDoc.soundPath); null for library songs. */
  soundPath: string | null;
  /** Storage object fed to the provider as `audio_url`. */
  audioSourcePath: string;
  /** Catalog length or client claim — only a fallback if the output can't be measured. */
  expectedSeconds: number;
  captions: string[];
  /** Speech alignment: on for spoken sound, off for singing. */
  transcription: boolean;
  /** Preview renders get their audio trimmed server-side. */
  trimToSeconds: number | null;
}

function claimedSeconds(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < MIN_PERFORMANCE_SECONDS ||
    value > MAX_PERFORMANCE_SECONDS
  ) {
    fail('invalid_input');
  }
  return value;
}

function requestCaptions(value: unknown): string[] {
  return checkCaptions(value) ? value.map((line) => line.trim()) : [];
}

interface ResolvedSound {
  soundKind: SoundSource['kind'];
  songId: string | null;
  soundPath: string | null;
  audioSourcePath: string;
  expectedSeconds: number;
  captions: string[];
  transcription: boolean;
}

function resolveSound(value: unknown, captions: unknown, uid: string): ResolvedSound {
  const sound = asObject(value);
  switch (sound.kind) {
    case 'song': {
      const song = typeof sound.songId === 'string' ? findSong(sound.songId) : undefined;
      if (!song) fail('invalid_input');
      return {
        soundKind: 'song',
        songId: song.id,
        soundPath: null,
        audioSourcePath: storagePaths.catalogSong(song.id),
        expectedSeconds: Math.min(song.seconds, MAX_PERFORMANCE_SECONDS),
        captions: [...song.lyrics],
        transcription: false,
      };
    }
    case 'recording':
    case 'voice':
    case 'personalSong': {
      const root = sound.kind === 'recording' ? 'uploads' : sound.kind === 'voice' ? 'voices' : 'songs';
      if (!isOwnedMediaPath(sound.storagePath, uid, [root])) fail('invalid_input');
      return {
        soundKind: sound.kind,
        songId: null,
        soundPath: sound.storagePath,
        audioSourcePath: sound.storagePath,
        expectedSeconds: claimedSeconds(sound.seconds),
        captions: sound.kind === 'recording' ? [] : requestCaptions(captions),
        transcription: sound.kind !== 'personalSong',
      };
    }
    default:
      return fail('invalid_input');
  }
}

export function parseCreateRender(data: unknown, uid: string): RenderPlan {
  const d = asObject(data);
  const idempotencyKey = idempotencyKeyOf(d);
  if (d.purpose !== 'preview' && d.purpose !== 'full') fail('invalid_input');
  const purpose = d.purpose;
  if (typeof d.lookId !== 'string' || !findLook(d.lookId)) fail('invalid_input');
  if (!isOwnedMediaPath(d.imagePath, uid, ['uploads', 'posters'])) fail('invalid_input');
  if (!RESOLUTIONS.includes(d.resolution as Resolution)) fail('invalid_input');
  const requested = d.resolution as Resolution;
  const wantsHdBoost = optionalBoolean(d.useHdBoostToken);
  const sound = resolveSound(d.sound, d.captions, uid);

  const base = { idempotencyKey, imagePath: d.imagePath, lookId: d.lookId, ...sound };

  if (purpose === 'preview') {
    // One free, short, watermarked, low-resolution render per account.
    return {
      ...base,
      purpose,
      renderResolution: PREVIEW.resolution,
      billingResolution: PREVIEW.resolution,
      requiresPro: false,
      useHdBoostToken: false,
      reservedCredits: renderReservation('preview', PREVIEW.resolution),
      expectedSeconds: Math.min(sound.expectedSeconds, PREVIEW.seconds),
      trimToSeconds: PREVIEW.seconds,
    };
  }

  if (wantsHdBoost) {
    // The hdBoost prize renders at 1080p for the 768p price, without Pro.
    if (requested !== '768p') fail('invalid_input');
    return {
      ...base,
      purpose,
      renderResolution: '1080p',
      billingResolution: '768p',
      requiresPro: false,
      useHdBoostToken: true,
      reservedCredits: renderReservation('full', '768p'),
      trimToSeconds: null,
    };
  }

  return {
    ...base,
    purpose,
    renderResolution: requested,
    billingResolution: requested,
    requiresPro: RESOLUTION_INFO[requested].proOnly,
    useHdBoostToken: false,
    reservedCredits: renderReservation('full', requested),
    trimToSeconds: null,
  };
}

export function parseCancelRender(data: unknown): { renderId: string } {
  const d = asObject(data);
  if (typeof d.renderId !== 'string' || !UUID_PATTERN.test(d.renderId)) fail('invalid_input');
  return { renderId: d.renderId.toLowerCase() };
}

/** deleteRender: just the owner-scoped render id. */
export function parseDeleteRender(data: unknown): { renderId: string } {
  return parseCancelRender(data);
}

/** reportRender: render id + one of the fixed reasons (no free text reaches the server). */
export function parseReportRender(data: unknown): { renderId: string; reason: ReportReason } {
  const { renderId } = parseCancelRender(data);
  const reason = asObject(data).reason;
  if (typeof reason !== 'string' || !(REPORT_REASONS as readonly string[]).includes(reason)) fail('invalid_input');
  return { renderId, reason: reason as ReportReason };
}
