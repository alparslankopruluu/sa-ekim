/** Finalize task contract (pure): payload shape and the de-duplication id. */
import { UID_PATTERN, UUID_PATTERN } from './paths.js';

export interface FinalizePreviewTask {
  uid: string;
  previewId: string;
}

export function parseFinalizeTask(data: unknown): FinalizePreviewTask | null {
  if (!data || typeof data !== 'object') return null;
  const { uid, previewId } = data as Record<string, unknown>;
  if (typeof uid !== 'string' || !UID_PATTERN.test(uid)) return null;
  if (typeof previewId !== 'string' || !UUID_PATTERN.test(previewId)) return null;
  return { uid, previewId };
}

/**
 * Cloud Tasks remembers a task id for about an hour after it ran, so the id carries the attempt:
 * the quality-gate retry (attempt 2) must not be swallowed as a duplicate of attempt 1.
 */
export function finalizeTaskId(previewId: string, attempt: number): string {
  return `${previewId}-${Math.max(1, Math.floor(attempt))}`;
}
