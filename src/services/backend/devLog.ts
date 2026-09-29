/**
 * In-memory ring buffer of analytics/crash breadcrumbs for the Developer screen.
 * Lets anyone verify event wiring in mock mode (the DebugView stand-in).
 * Holds sanitized names/params only — never user text or media URLs.
 */
export interface DevLogEntry {
  at: number;
  kind: 'event' | 'screen' | 'property' | 'crash' | 'breadcrumb';
  name: string;
  detail?: string;
}

const MAX_ENTRIES = 200;
const entries: DevLogEntry[] = [];
const listeners = new Set<() => void>();

export function pushDevLog(entry: Omit<DevLogEntry, 'at'>): void {
  entries.unshift({ ...entry, at: Date.now() });
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  listeners.forEach((listener) => listener());
}

export function readDevLog(): readonly DevLogEntry[] {
  return entries;
}

export function subscribeDevLog(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
