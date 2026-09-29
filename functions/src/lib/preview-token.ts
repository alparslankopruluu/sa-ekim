/**
 * Per-preview webhook token. Each fal job gets a webhook URL carrying
 * `t = HMAC-SHA256(salt, "v1:{uid}:{previewId}")`, so only the URL we handed to
 * fal for that exact preview passes, before any signature or Firestore work.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createPreviewToken(salt: string, uid: string, previewId: string): string {
  if (!salt) throw new Error('preview token salt missing');
  return createHmac('sha256', salt).update(`v1:${uid}:${previewId}`).digest('base64url');
}

/** Constant-time comparison; malformed input is rejected without leaking timing on the secret. */
export function verifyPreviewToken(salt: string, uid: string, previewId: string, token: unknown): boolean {
  if (!salt || typeof token !== 'string' || !TOKEN_PATTERN.test(token)) return false;
  const expected = Buffer.from(createPreviewToken(salt, uid, previewId), 'utf8');
  const given = Buffer.from(token, 'utf8');
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Webhook URL for one preview: `<base>?uid=…&previewId=…&t=…`. */
export function buildFalWebhookUrl(baseUrl: string, uid: string, previewId: string, token: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set('uid', uid);
  url.searchParams.set('previewId', previewId);
  url.searchParams.set('t', token);
  return url.toString();
}
