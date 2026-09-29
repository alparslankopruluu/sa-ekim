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
  const cached = path ? cache.get(path) : undefined;
  const [uri, setUri] = useState<string | null>(cached && Date.now() - cached.at < TTL_MS ? cached.uri : null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!path) {
      setUri(null);
      setFailed(false);
      return;
    }
    const hit = cache.get(path);
    if (hit && Date.now() - hit.at < TTL_MS && attempt === 0) {
      setUri(hit.uri);
      setFailed(false);
      return;
    }
    let alive = true;
    setFailed(false);
    resolveMediaUrl(path)
      .then((resolved) => {
        if (!alive) return;
        if (resolved) {
          cache.set(path, { uri: resolved, at: Date.now() });
          setUri(resolved);
        } else {
          setFailed(true);
        }
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [path, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  return { uri, failed, reload };
}

/** Drops cached URLs (after a delete, so a recycled cell never shows a removed preview). */
export function forgetMediaUrl(path: string | null | undefined): void {
  if (path) cache.delete(path);
}
