/**
 * Runtime switches from `config/runtime` (Firestore, server-only), read through a short cache.
 *   generationEnabled    kill switch: missing doc or field means ENABLED (fail-open — the switch exists
 *                        to stop a spend incident, not to add a new outage mode); only `false` disables;
 *   imageModelQueueURL   optional fal queue URL (host-pinned, see image-model.ts).
 * A failed read falls back to the last known value, or to the defaults.
 */
import { DEFAULT_IMAGE_MODEL, type ImageModel, resolveImageModel } from './image-model.js';

export const RUNTIME_CACHE_TTL_MS = 60_000;

export interface RuntimeConfig {
  generationEnabled: boolean;
  imageModel: ImageModel;
}

export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = { generationEnabled: true, imageModel: DEFAULT_IMAGE_MODEL };

export function parseRuntimeConfig(data: unknown): RuntimeConfig {
  const record = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  return {
    generationEnabled: record.generationEnabled !== false,
    imageModel: resolveImageModel(record.imageModelQueueURL),
  };
}

export function isCacheFresh(fetchedAt: number | null, now: number, ttlMs = RUNTIME_CACHE_TTL_MS): boolean {
  return fetchedAt !== null && now - fetchedAt < ttlMs;
}

let cache: { at: number; value: RuntimeConfig } | null = null;

export type ConfigLoader = () => Promise<unknown>;

/** Loader is injected by the caller (Firestore read) so this module stays testable without Firebase. */
export async function getRuntimeConfig(load: ConfigLoader, now: number = Date.now()): Promise<RuntimeConfig> {
  if (cache && isCacheFresh(cache.at, now)) return cache.value;
  try {
    const value = parseRuntimeConfig(await load());
    cache = { at: now, value };
    return value;
  } catch {
    return cache?.value ?? DEFAULT_RUNTIME_CONFIG;
  }
}

export function resetRuntimeConfigCache(): void {
  cache = null;
}
