/**
 * Typed converters for server documents (no `as any` on Firestore payloads —
 * docs/stack.md forbidden patterns). Unknown/invalid documents are dropped.
 */
import {
  type GiftDoc,
  isErrorCode,
  RENDER_STATUSES,
  type RenderDoc,
  type RenderStatus,
  type WalletDoc,
} from '@shared/api';
import { RESOLUTIONS, type Resolution } from '@shared/pricing';
import { PRIZES, type PrizeId } from '@shared/wheel';

type Raw = Record<string, unknown>;

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null;
}

function num(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  // Firestore Timestamp-like objects.
  if (isRecord(value) && typeof value.toMillis === 'function') {
    const millis = (value.toMillis as () => unknown)();
    return typeof millis === 'number' ? millis : fallback;
  }
  return fallback;
}

function str(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function parseRender(id: string, data: unknown): RenderDoc | null {
  if (!isRecord(data)) return null;
  const status = str(data.status);
  const resolution = str(data.resolution);
  const soundKind = str(data.soundKind);
  if (!status || !(RENDER_STATUSES as readonly string[]).includes(status)) return null;
  if (!resolution || !(RESOLUTIONS as readonly string[]).includes(resolution)) return null;
  if (soundKind !== 'song' && soundKind !== 'recording' && soundKind !== 'voice' && soundKind !== 'personalSong') {
    return null;
  }
  const errorCode = data.errorCode;
  const captions = Array.isArray(data.captions) ? data.captions.filter((c): c is string => typeof c === 'string') : [];
  return {
    id,
    status: status as RenderStatus,
    purpose: data.purpose === 'preview' ? 'preview' : 'full',
    resolution: resolution as Resolution,
    lookId: str(data.lookId) ?? 'original',
    soundKind,
    songId: str(data.songId),
    progress: Math.min(1, Math.max(0, num(data.progress))),
    reservedCredits: num(data.reservedCredits),
    chargedCredits: num(data.chargedCredits),
    seconds: typeof data.seconds === 'number' ? data.seconds : null,
    imagePath: str(data.imagePath) ?? '',
    soundPath: str(data.soundPath),
    captions: captions.slice(0, 4),
    videoPath: str(data.videoPath),
    watermarked: data.watermarked === true,
    errorCode: isErrorCode(errorCode) ? errorCode : null,
    createdAt: num(data.createdAt),
    updatedAt: num(data.updatedAt),
  };
}

export function parseWallet(data: unknown): WalletDoc {
  const raw = isRecord(data) ? data : {};
  return {
    balance: Math.max(0, num(raw.balance)),
    freePosterTokens: Math.max(0, num(raw.freePosterTokens)),
    hdBoostTokens: Math.max(0, num(raw.hdBoostTokens)),
    previewUsed: raw.previewUsed === true,
    updatedAt: num(raw.updatedAt),
  };
}

export function parseGift(data: unknown): GiftDoc | null {
  if (!isRecord(data)) return null;
  const prizeId = str(data.prizeId);
  if (!prizeId || !(prizeId in PRIZES)) return null;
  return {
    prizeId: prizeId as PrizeId,
    segmentIndex: num(data.segmentIndex),
    spunAt: num(data.spunAt),
    expiresAt: num(data.expiresAt),
    redeemedAt: data.redeemedAt == null ? null : num(data.redeemedAt),
  };
}
