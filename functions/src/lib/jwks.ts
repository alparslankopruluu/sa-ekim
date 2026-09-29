/**
 * fal's webhook public keys, cached per instance. VERIFY the JWKS URL against
 * current fal docs before launch. A failed verification may force one refresh
 * (key rotation), at most every few minutes.
 */
import type { FalJwk } from './webhook-signature.js';

export const FAL_JWKS_URL = 'https://rest.alpha.fal.ai/.well-known/jwks.json';

const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const MIN_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

let cache: { keys: FalJwk[]; fetchedAt: number } | null = null;

function parseJwks(body: unknown): FalJwk[] {
  if (!body || typeof body !== 'object' || !Array.isArray((body as { keys?: unknown }).keys)) return [];
  return ((body as { keys: unknown[] }).keys)
    .filter((k): k is Record<string, unknown> => !!k && typeof k === 'object')
    .filter((k) => typeof k.x === 'string')
    .map((k) => ({
      x: k.x as string,
      kty: typeof k.kty === 'string' ? k.kty : undefined,
      crv: typeof k.crv === 'string' ? k.crv : undefined,
      kid: typeof k.kid === 'string' ? k.kid : undefined,
    }));
}

async function fetchJwks(): Promise<FalJwk[]> {
  const response = await fetch(FAL_JWKS_URL, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`jwks http ${response.status}`);
  const keys = parseJwks(await response.json());
  if (keys.length === 0) throw new Error('jwks empty');
  return keys;
}

export async function getFalJwks(options: { forceRefresh?: boolean } = {}): Promise<FalJwk[]> {
  const now = Date.now();
  const fresh = cache && now - cache.fetchedAt < CACHE_TTL_MS;
  const mayRefresh = !cache || now - cache.fetchedAt >= MIN_REFRESH_INTERVAL_MS;
  if (cache && fresh && !(options.forceRefresh && mayRefresh)) return cache.keys;
  try {
    const keys = await fetchJwks();
    cache = { keys, fetchedAt: now };
    return keys;
  } catch (error) {
    // Serve stale keys rather than failing every webhook during a JWKS outage.
    if (cache) return cache.keys;
    throw error;
  }
}

/** Whether a forced refresh would actually refetch (used to decide on a retry). */
export function canRefreshJwks(): boolean {
  return !cache || Date.now() - cache.fetchedAt >= MIN_REFRESH_INTERVAL_MS;
}
