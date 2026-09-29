/**
 * fal webhook signature verification — pure (keys are passed in), so it is
 * unit-tested with locally generated ed25519 key pairs.
 *
 * VERIFY against current fal docs ("Webhooks → Verifying webhook signatures")
 * before launch. As implemented:
 *   headers  x-fal-webhook-request-id, x-fal-webhook-user-id,
 *            x-fal-webhook-timestamp (unix seconds), x-fal-webhook-signature (hex)
 *   message  `${requestId}\n${userId}\n${timestamp}\n${sha256hex(rawBody)}`
 *   keys     ED25519 JWKs (`x`, base64url) from https://rest.alpha.fal.ai/.well-known/jwks.json
 *   window   ±300 s around the server clock
 */
import { createHash, createPublicKey, type KeyObject, verify } from 'node:crypto';

export interface FalJwk {
  kty?: string;
  crv?: string;
  x: string;
  kid?: string;
}

export interface FalSignatureHeaders {
  requestId: string;
  userId: string;
  timestamp: string;
  signature: string;
}

export type HeaderBag = Record<string, string | string[] | undefined>;

export const FAL_TIMESTAMP_TOLERANCE_SECONDS = 300;

function header(headers: HeaderBag, name: string): string | null {
  const value = headers[name] ?? headers[name.toLowerCase()];
  const single = Array.isArray(value) ? value[0] : value;
  return typeof single === 'string' && single.length > 0 && single.length <= 512 ? single : null;
}

export function readFalSignatureHeaders(headers: HeaderBag): FalSignatureHeaders | null {
  const requestId = header(headers, 'x-fal-webhook-request-id');
  const userId = header(headers, 'x-fal-webhook-user-id');
  const timestamp = header(headers, 'x-fal-webhook-timestamp');
  const signature = header(headers, 'x-fal-webhook-signature');
  if (!requestId || !userId || !timestamp || !signature) return null;
  return { requestId, userId, timestamp, signature };
}

export function buildFalSignedMessage(h: FalSignatureHeaders, rawBody: Buffer): Buffer {
  const bodyHash = createHash('sha256').update(rawBody).digest('hex');
  return Buffer.from(`${h.requestId}\n${h.userId}\n${h.timestamp}\n${bodyHash}`, 'utf8');
}

function publicKeyFromJwk(jwk: FalJwk): KeyObject | null {
  if (typeof jwk.x !== 'string' || (jwk.kty && jwk.kty !== 'OKP') || (jwk.crv && jwk.crv !== 'Ed25519')) {
    return null;
  }
  try {
    return createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: jwk.x }, format: 'jwk' });
  } catch {
    return null;
  }
}

export type FalVerifyResult =
  | { ok: true; requestId: string }
  | { ok: false; reason: 'missing_headers' | 'stale_timestamp' | 'malformed_signature' | 'bad_signature' | 'no_keys' };

export function verifyFalWebhookSignature(input: {
  headers: HeaderBag;
  rawBody: Buffer;
  keys: readonly FalJwk[];
  nowSeconds: number;
  toleranceSeconds?: number;
}): FalVerifyResult {
  const h = readFalSignatureHeaders(input.headers);
  if (!h) return { ok: false, reason: 'missing_headers' };
  if (!/^\d{1,12}$/.test(h.timestamp)) return { ok: false, reason: 'stale_timestamp' };
  const tolerance = input.toleranceSeconds ?? FAL_TIMESTAMP_TOLERANCE_SECONDS;
  if (Math.abs(input.nowSeconds - Number(h.timestamp)) > tolerance) return { ok: false, reason: 'stale_timestamp' };
  if (!/^[0-9a-fA-F]{128}$/.test(h.signature)) return { ok: false, reason: 'malformed_signature' };
  const signature = Buffer.from(h.signature, 'hex');
  const keys = input.keys.map(publicKeyFromJwk).filter((k): k is KeyObject => k !== null);
  if (keys.length === 0) return { ok: false, reason: 'no_keys' };
  const message = buildFalSignedMessage(h, input.rawBody);
  for (const key of keys) {
    try {
      if (verify(null, message, key, signature)) return { ok: true, requestId: h.requestId };
    } catch {
      // A malformed key must not abort verification against the others.
    }
  }
  return { ok: false, reason: 'bad_signature' };
}
