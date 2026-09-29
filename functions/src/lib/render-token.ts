/**
 * Per-render webhook token. Each fal job gets a webhook URL carrying
 * `t = HMAC-SHA256(salt, "v1:{uid}:{renderId}")`, so only the URL we handed to
 * fal for that exact render passes, before any signature or Firestore work.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createRenderToken(salt: string, uid: string, renderId: string): string {
  if (!salt) throw new Error('render token salt missing');
  return createHmac('sha256', salt).update(`v1:${uid}:${renderId}`).digest('base64url');
}

/** Constant-time comparison; malformed input is rejected without leaking timing on the secret. */
export function verifyRenderToken(salt: string, uid: string, renderId: string, token: unknown): boolean {
  if (!salt || typeof token !== 'string' || !TOKEN_PATTERN.test(token)) return false;
  const expected = Buffer.from(createRenderToken(salt, uid, renderId), 'utf8');
  const given = Buffer.from(token, 'utf8');
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Webhook URL for one render: `<base>?uid=…&renderId=…&t=…`. */
export function buildFalWebhookUrl(baseUrl: string, uid: string, renderId: string, token: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set('uid', uid);
  url.searchParams.set('renderId', renderId);
  url.searchParams.set('t', token);
  return url.toString();
}
