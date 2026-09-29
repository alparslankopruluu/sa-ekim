/**
 * Structured logging with an allowlist of primitive fields. uids are hashed;
 * URLs, prompts, user text, tokens and provider payloads have no field here,
 * so they cannot be logged by accident.
 */
import { createHash } from 'node:crypto';

import * as logger from 'firebase-functions/logger';

export interface LogFields {
  /** Raw uid — replaced by a short one-way hash before logging. */
  uid?: string;
  previewId?: string;
  code?: string;
  kind?: string;
  status?: string;
  eventType?: string;
  errorName?: string;
  httpStatus?: number;
  count?: number;
  attempt?: number;
  seconds?: number;
  credits?: number;
  durationMs?: number;
  reason?: string;
}

export function uidTag(uid: string): string {
  return createHash('sha256').update(uid).digest('hex').slice(0, 12);
}

function sanitize(fields: LogFields): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(fields) as [keyof LogFields, unknown][]) {
    if (value === undefined || value === null) continue;
    if (key === 'uid') {
      out.uidTag = uidTag(String(value));
    } else if (typeof value === 'number') {
      out[key] = value;
    } else {
      out[key] = String(value).slice(0, 80);
    }
  }
  return out;
}

export const log = {
  info(event: string, fields: LogFields = {}): void {
    logger.info(event, sanitize(fields));
  },
  warn(event: string, fields: LogFields = {}): void {
    logger.warn(event, sanitize(fields));
  },
  error(event: string, fields: LogFields = {}): void {
    logger.error(event, sanitize(fields));
  },
};
