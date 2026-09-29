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
  render: (uid: string, renderId: string) => `users/${uid}/renders/${renderId}`,
  renders: (uid: string) => `users/${uid}/renders`,
  /** Server-only render state (provider request id, billing details). */
  renderPrivate: (uid: string, renderId: string) => `users/${uid}/renders_private/${renderId}`,
  devices: (uid: string) => `users/${uid}/devices`,
  /** Processed RevenueCat event ids (idempotency). */
  rcEvent: (uid: string, eventId: string) => `users/${uid}/rc_events/${eventId}`,
  wheelConfig: () => 'config/wheel',
  /** Content reports for human review (server-only; one per user + render). */
  report: (uid: string, renderId: string) => `reports/${uid}_${renderId}`,
} as const;

export const storagePaths = {
  poster: (uid: string, id: string) => `posters/${uid}/${id}.png`,
  voice: (uid: string, id: string) => `voices/${uid}/${id}.mp3`,
  song: (uid: string, id: string) => `songs/${uid}/${id}.mp3`,
  render: (uid: string, renderId: string) => `renders/${uid}/${renderId}.mp4`,
  /** Server-only trimmed audio for preview renders (no client access in storage.rules). */
  renderAudio: (uid: string, renderId: string) => `tmp/${uid}/${renderId}.mp3`,
  catalogSong: (songId: string) => `catalog/songs/${songId}.mp3`,
} as const;

/** Every Storage root that holds per-user media (account deletion wipes all of them). */
export const USER_MEDIA_ROOTS = ['uploads', 'posters', 'voices', 'songs', 'renders', 'tmp'] as const;

/** Source media deleted by the hourly retention sweep (rendered videos are kept). */
export const EPHEMERAL_MEDIA_ROOTS = ['uploads', 'voices', 'songs', 'posters', 'tmp'] as const;

/** Firebase Auth uids: 1–128 chars; we accept the URL-safe alphabet only. */
export const UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
/** Render ids and idempotency keys are UUIDs. */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `users/{uid}/<sub>/{id}` → uid (used by collection-group maintenance queries). */
export function uidFromUserDocPath(path: string): string | null {
  const parts = path.split('/');
  if (parts.length < 4 || parts[0] !== 'users') return null;
  const uid = parts[1] ?? '';
  return UID_PATTERN.test(uid) ? uid : null;
}
