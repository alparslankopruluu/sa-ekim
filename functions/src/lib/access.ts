/**
 * Consent and entitlement gates (pure). Entitlement truth is the server mirror
 * written only by the RevenueCat webhook — never a client flag.
 */

/** Minimum AI-processing disclosure version that unlocks generation. */
export const MIN_CONSENT_VERSION = 1;

/** `users/{uid}/private/consent` `{ version, acceptedAt }`. */
export function hasConsent(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const version = (data as { version?: unknown }).version;
  return typeof version === 'number' && Number.isFinite(version) && version >= MIN_CONSENT_VERSION;
}

/** `users/{uid}/private/entitlement` mirror: active while `pro` and not past `expiresAt`. */
export function isProActive(data: unknown, now: number): boolean {
  if (!data || typeof data !== 'object') return false;
  const d = data as { pro?: unknown; expiresAt?: unknown };
  if (d.pro !== true) return false;
  return typeof d.expiresAt !== 'number' || d.expiresAt > now;
}
