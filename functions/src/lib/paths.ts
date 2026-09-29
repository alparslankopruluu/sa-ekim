/**
 * Every Firestore document and Storage object path in one place, so rules,
 * cleanup, account deletion and the callables can never drift apart.
 */

export const docPaths = {
  user: (uid: string) => `users/${uid}`,
  wallet: (uid: string) => `users/${uid}/private/wallet`,
  consent: (uid: string) => `users/${uid}/private/consent`,
  entitlement: (uid: string) => `users/${uid}/private/entitlement`,
  gift: (uid: string) => `users/${uid}/private/gift`,
  request: (uid: string, idempotencyKey: string) => `users/${uid}/requests/${idempotencyKey}`,
  requests: (uid: string) => `users/${uid}/requests`,
  ledger: (uid: string) => `users/${uid}/ledger`,
  preview: (uid: string, previewId: string) => `users/${uid}/previews/${previewId}`,
  previews: (uid: string) => `users/${uid}/previews`,
  /** Server-only preview state (fal request id, billing details, region hint). */
  previewPrivate: (uid: string, previewId: string) => `users/${uid}/previews_private/${previewId}`,
  devices: (uid: string) => `users/${uid}/devices`,
  /** Processed RevenueCat event ids (idempotency). */
  rcEvent: (uid: string, eventId: string) => `users/${uid}/rc_events/${eventId}`,
  /** Opt-in same-week cohort: a minimal document, one per user, keyed by uid. */
  cohortMember: (uid: string) => `cohortMembers/${uid}`,
  cohortMembers: () => 'cohortMembers',
  reports: () => 'reports',
  runtimeConfig: () => 'config/runtime',
  wheelConfig: () => 'config/wheel',
} as const;

export const storagePaths = {
  /** Result image of one preview (server-written, owner-readable). */
  previewResult: (uid: string, previewId: string) => `users/${uid}/previews/${previewId}.jpg`,
} as const;

/** Every Storage prefix that holds per-user media (account deletion wipes all of them). */
export const userMediaPrefixes = (uid: string): string[] => [`uploads/${uid}/`, `users/${uid}/`];

/** Firebase Auth uids: 1–128 chars; we accept the URL-safe alphabet only. */
export const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
/** Preview ids are UUIDs. */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `users/{uid}/<sub>/{id}` → uid (used by collection-group maintenance queries). */
export function uidFromUserDocPath(path: string): string | null {
  const parts = path.split('/');
  if (parts.length < 4 || parts[0] !== 'users') return null;
  const uid = parts[1] ?? '';
  return UID_PATTERN.test(uid) ? uid : null;
}
