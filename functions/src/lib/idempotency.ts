/**
 * Idempotency records: `users/{uid}/requests/{idempotencyKey}`. A replay with
 * the same key returns the stored outcome and never charges twice.
 */
import { type ErrorCode, isErrorCode } from '../shared/api.js';
import { normalizeCharge, type WalletCharge } from './ledger.js';

export type RequestKind = 'createPoster' | 'synthesizeVoice' | 'composeSong' | 'createRender';
export type RequestStatus = 'pending' | 'done' | 'failed';

export interface RequestRecord {
  kind: RequestKind;
  status: RequestStatus;
  /** What was taken from the wallet (paid steps); renders keep theirs in renders_private. */
  charge: WalletCharge;
  /** Id of the thing produced (poster/voice/song id, or renderId). */
  refId: string;
  /** Stored response, minus short-lived URLs (re-signed on replay). */
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
  const kinds: RequestKind[] = ['createPoster', 'synthesizeVoice', 'composeSong', 'createRender'];
  const statuses: RequestStatus[] = ['pending', 'done', 'failed'];
  if (!kinds.includes(d.kind as RequestKind) || !statuses.includes(d.status as RequestStatus)) return null;
  return {
    kind: d.kind as RequestKind,
    status: d.status as RequestStatus,
    charge: normalizeCharge(d.charge),
    refId: typeof d.refId === 'string' ? d.refId : '',
    response: d.response && typeof d.response === 'object' ? (d.response as Record<string, unknown>) : null,
    errorCode: isErrorCode(d.errorCode) ? d.errorCode : null,
    createdAt: typeof d.createdAt === 'number' ? d.createdAt : 0,
    updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : 0,
  };
}

/**
 * - no record → proceed (charge and run);
 * - done → replay the stored response;
 * - failed → the same failure (the client uses a new key to try again);
 * - pending → still in flight: renders replay (their doc already exists),
 *   other steps ask the client to retry shortly;
 * - a key reused for a different action → invalid input.
 */
export function decideReplay(existing: unknown, kind: RequestKind): ReplayDecision {
  if (existing === undefined || existing === null) return { action: 'proceed' };
  const record = parseRequestRecord(existing);
  if (!record || record.kind !== kind) return { action: 'reject', code: 'invalid_input' };
  if (record.status === 'done') {
    return record.response ? { action: 'replay', record } : { action: 'reject', code: 'unknown' };
  }
  if (record.status === 'failed') return { action: 'reject', code: record.errorCode ?? 'unknown' };
  if (kind === 'createRender' && record.response) return { action: 'replay', record };
  return { action: 'reject', code: 'rate_limited' };
}
