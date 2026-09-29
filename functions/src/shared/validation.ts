/**
 * Input validation shared by the app (instant feedback) and Functions (authority).
 * The server always re-validates; the client copy only avoids wasted round trips.
 */
import { MAX_SHED_COUNT } from './catalog.js';

export const MAX_CLINIC_NAME = 60;
export const MAX_NOTE_LENGTH = 280;

/** A deliberately small, conservative blocklist for free text sent to the server (reports). */
const BLOCKED_TERMS = ['nude', 'naked', 'porn', 'rape', 'kill yourself', 'kys', 'nazi', 'hitler', 'terrorist'];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function containsBlockedTerm(text: string): boolean {
  const value = normalize(text);
  return BLOCKED_TERMS.some((term) => new RegExp(`(^|[^a-z])${term}($|[^a-z])`).test(value));
}

export type TextVerdict = 'ok' | 'too_short' | 'too_long' | 'blocked';

/** Clinic name or note: kept on device, but bounded and free of control characters. */
export function checkFreeText(text: string, max: number): TextVerdict {
  const trimmed = text.trim();
  if (trimmed.length < 1) return 'too_short';
  if (trimmed.length > max) return 'too_long';
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(trimmed) || containsBlockedTerm(trimmed)) return 'blocked';
  return 'ok';
}

/** Shed count from a text field: a whole number in 0..MAX_SHED_COUNT, or null. */
export function parseShedCount(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d{1,3}$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value >= 0 && value <= MAX_SHED_COUNT ? value : null;
}

/** Idempotency keys: UUID-ish, bounded, no path characters. */
export function isValidIdempotencyKey(key: unknown): key is string {
  return typeof key === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(key);
}
