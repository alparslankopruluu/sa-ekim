/** Retention decisions for the hourly sweep (pure). */

/** True when an object's `timeCreated` (RFC 3339) is older than `ttlMs`. Unknown ages are kept. */
export function isExpiredMedia(timeCreated: unknown, now: number, ttlMs: number): boolean {
  if (typeof timeCreated !== 'string') return false;
  const created = Date.parse(timeCreated);
  return Number.isFinite(created) && now - created > ttlMs;
}

/**
 * A non-terminal render is stuck once it is older than `stuckMs`; a render
 * the finalize task already claimed gets `finalizingMs` since its last update.
 */
export function isStuckRender(
  render: { status: unknown; createdAt: unknown; updatedAt: unknown },
  now: number,
  limits: { stuckMs: number; finalizingMs: number },
): boolean {
  const { status, createdAt, updatedAt } = render;
  if (status !== 'queued' && status !== 'processing' && status !== 'finalizing') return false;
  if (typeof createdAt !== 'number' || now - createdAt <= limits.stuckMs) return false;
  if (status === 'finalizing') return typeof updatedAt !== 'number' || now - updatedAt > limits.finalizingMs;
  return true;
}
