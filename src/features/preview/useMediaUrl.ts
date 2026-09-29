import { useCallback, useEffect, useState } from 'react';

import { resolveMediaUrl } from '@/services/generation';

const TTL_MS = 4 * 60 * 1000;
const cache = new Map<string, { uri: string; at: number }>();

export interface MediaUrl {
  uri: string | null;
  failed: boolean;
  reload(): void;
}

/**
 * Resolves a storage path to a displayable URL (a signed URL live, a local URI in mock mode).
 * Recently resolved paths are cached briefly so list cells that recycle do not flash.
 */
export function useMediaUrl(path: string | null | undefined): MediaUrl {
  const [attempt, setAttempt] = useState(0);
  // The resolved value is keyed by path + attempt, so state is only ever set from the async
  // callback (never synchronously in the effect body) and a recycled cell never shows a stale URL.
  const key = path ? `${path}#${attempt}` : null;
  const [resolved, setResolved] = useState<{ key: string; uri: string | null; failed: boolean } | null>(null);

  useEffect(() => {
    if (!path || !key) return;
    let alive = true;
    const hit = attempt === 0 ? freshHit(path) : null;
    const pending = hit ? Promise.resolve(hit) : resolveMediaUrl(path);
    pending
      .then((uri) => {
        if (!alive) return;
        if (uri) cache.set(path, { uri, at: Date.now() });
        setResolved({ key, uri: uri || null, failed: !uri });
      })
      .catch(() => {
        if (alive) setResolved({ key, uri: null, failed: true });
      });
    return () => {
      alive = false;
    };
  }, [path, key, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  if (!path) return { uri: null, failed: false, reload };
  if (resolved?.key === key) return { uri: resolved.uri, failed: resolved.failed, reload };
  // Still resolving: keep showing the last good URL for this path (no flash while cells recycle).
  return { uri: cache.get(path)?.uri ?? null, failed: false, reload };
}

function freshHit(path: string): string | null {
  const hit = cache.get(path);
  return hit && Date.now() - hit.at < TTL_MS ? hit.uri : null;
}

/** Drops cached URLs (after a delete, so a recycled cell never shows a removed preview). */
export function forgetMediaUrl(path: string | null | undefined): void {
  if (path) cache.delete(path);
}
