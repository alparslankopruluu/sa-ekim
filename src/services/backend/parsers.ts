/**
 * Typed converters for server documents (no `as any` on Firestore payloads —
 * docs/stack.md forbidden patterns). Unknown/invalid documents are dropped.
 */
import {
  type GiftDoc,
  isErrorCode,
  PREVIEW_RETENTION_DAYS,
  PREVIEW_STATUSES,
  type PreviewDoc,
  type PreviewStatus,
  type WalletDoc,
} from '@shared/api';
import { isDensity, isGoal, isQuality, isStyleId } from '@shared/catalog';
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

export function parsePreview(id: string, data: unknown): PreviewDoc | null {
  if (!isRecord(data)) return null;
  const status = str(data.status);
  if (!status || !(PREVIEW_STATUSES as readonly string[]).includes(status)) return null;
  if (!isGoal(data.goal) || !isStyleId(data.styleId) || !isDensity(data.density) || !isQuality(data.quality)) {
    return null;
  }
  const errorCode = data.errorCode;
  const createdAt = num(data.createdAt);
  return {
    id,
    status: status as PreviewStatus,
    goal: data.goal,
    styleId: data.styleId,
    density: data.density,
    quality: data.quality,
    progress: Math.min(1, Math.max(0, num(data.progress))),
    reservedCredits: Math.max(0, num(data.reservedCredits)),
    chargedCredits: Math.max(0, num(data.chargedCredits)),
    photoPath: str(data.photoPath) ?? '',
    resultPath: str(data.resultPath),
    watermarked: data.watermarked === true,
    onboarding: data.onboarding === true,
    errorCode: isErrorCode(errorCode) ? errorCode : null,
    createdAt,
    updatedAt: num(data.updatedAt),
    // Older documents without the field still get the documented retention window.
    expiresAt: num(data.expiresAt, createdAt + PREVIEW_RETENTION_DAYS * 24 * 60 * 60 * 1000),
  };
}

export function parseWallet(data: unknown): WalletDoc {
  const raw = isRecord(data) ? data : {};
  return {
    balance: Math.max(0, num(raw.balance)),
    freeHighTokens: Math.max(0, num(raw.freeHighTokens)),
    previewUsed: raw.previewUsed === true,
    updatedAt: num(raw.updatedAt),
  };
}

export function parseGift(data: unknown): GiftDoc | null {
  if (!isRecord(data)) return null;
  const prizeId = str(data.prizeId);
  if (!prizeId || !Object.hasOwn(PRIZES, prizeId)) return null;
  return {
    prizeId: prizeId as PrizeId,
    segmentIndex: num(data.segmentIndex),
    spunAt: num(data.spunAt),
    expiresAt: num(data.expiresAt),
    redeemedAt: data.redeemedAt == null ? null : num(data.redeemedAt),
  };
}
