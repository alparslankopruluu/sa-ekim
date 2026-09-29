/**
 * Idempotency records: `users/{uid}/requests/{idempotencyKey}`. A replay with
 * the same key returns the stored outcome and never charges twice.
 */
import { type ErrorCode, isErrorCode } from '../shared/api.js';

export type RequestKind = 'createPreview';
export type RequestStatus = 'pending' | 'done' | 'failed';

export interface RequestRecord {
  kind: RequestKind;
  status: RequestStatus;
  /** Id of the preview this request created. */
  refId: string;
  /** Stored response `{ previewId, reservedCredits }` (the balance is read fresh on replay). */
  response: Record<string, unknown> | null;
  errorCode: ErrorCode | null;
  createdAt: number;
  updatedAt: number;
}

export type ReplayDecision =
  | { action: 'proceed' }
  | { action: 'replay'; record: RequestRecord }
  | { action: 'reject'; code: ErrorCode };

export function parseRequestRecord(data: unknown): RequestRecord | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const statuses: RequestStatus[] = ['pending', 'done', 'failed'];
  if (d.kind !== 'createPreview' || !statuses.includes(d.status as RequestStatus)) return null;
  return {
    kind: 'createPreview',
    status: d.status as RequestStatus,
    refId: typeof d.refId === 'string' ? d.refId : '',
    response: d.response && typeof d.response === 'object' ? (d.response as Record<string, unknown>) : null,
    errorCode: isErrorCode(d.errorCode) ? d.errorCode : null,
    createdAt: typeof d.createdAt === 'number' ? d.createdAt : 0,
    updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : 0,
  };
}

/**
 * - no record → proceed (charge and run);
 * - done or pending with a stored response → replay it (the preview document already exists);
 * - failed → the same failure (the client uses a new key to try again);
 * - a key that belongs to some other action, or a record without a response → invalid input / unknown.
 */
export function decideReplay(existing: unknown): ReplayDecision {
  if (existing === undefined || existing === null) return { action: 'proceed' };
  const record = parseRequestRecord(existing);
  if (!record) return { action: 'reject', code: 'invalid_input' };
  if (record.status === 'failed') return { action: 'reject', code: record.errorCode ?? 'unknown' };
  return record.response ? { action: 'replay', record } : { action: 'reject', code: 'unknown' };
}
