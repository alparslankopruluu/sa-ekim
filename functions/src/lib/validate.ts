/**
 * Pure request parsers for every callable. They run before any credit is reserved, re-apply the
 * shared validators (the server is the authority), and turn a request into a fully resolved plan.
 */
import {
  REPORT_REASONS,
  type ReportReason,
} from '../shared/api.js';
import {
  type Density,
  type Goal,
  getStyle,
  isDensity,
  isGoal,
  isQuality,
  isStyleId,
  isValidRegionHint,
  JOURNEY_KINDS,
  type JourneyKind,
  type Quality,
  type RegionHint,
  type StyleId,
} from '../shared/catalog.js';
import { isIsoDate, type IsoDate } from '../shared/timeline.js';
import { isValidIdempotencyKey } from '../shared/validation.js';
import { fail } from './errors.js';
import { UUID_PATTERN } from './paths.js';
import { isUsableRegionArea } from './region-mask.js';

type Data = Record<string, unknown>;

function asObject(data: unknown): Data {
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail('invalid_input');
  return data as Data;
}

function optionalBoolean(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value !== 'boolean') fail('invalid_input');
  return value;
}

/** `uploads/{uid}/{file}` — exactly three segments, the caller's own uid, a plain image file name (mirrors storage.rules). */
export const UPLOAD_FILE_PATTERN = /^[A-Za-z0-9_-]{1,100}\.(jpg|jpeg|png|heic)$/;

export function isOwnedUploadPath(path: unknown, uid: string): path is string {
  if (typeof path !== 'string' || path.length > 300) return false;
  const parts = path.split('/');
  return parts.length === 3 && parts[0] === 'uploads' && parts[1] === uid && UPLOAD_FILE_PATTERN.test(parts[2] ?? '');
}

export function parseRecordConsent(data: unknown): { version: number } {
  const d = asObject(data);
  const version = d.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1 || version > 1000) fail('invalid_input');
  return { version };
}

export interface PreviewPlan {
  idempotencyKey: string;
  photoPath: string;
  goal: Goal;
  styleId: StyleId;
  density: Density;
  quality: Quality;
  regionHint: RegionHint | null;
  useFreeHighToken: boolean;
  onboarding: boolean;
}

export function parseCreatePreview(data: unknown, uid: string): PreviewPlan {
  const d = asObject(data);
  if (!isValidIdempotencyKey(d.idempotencyKey)) fail('invalid_input');
  if (!isOwnedUploadPath(d.photoPath, uid)) fail('invalid_input');
  if (!isGoal(d.goal) || !isStyleId(d.styleId) || !isDensity(d.density) || !isQuality(d.quality)) fail('invalid_input');
  const style = getStyle(d.styleId);
  if (!style || style.goal !== d.goal || !style.densities.includes(d.density)) fail('invalid_input');

  let regionHint: RegionHint | null = null;
  if (d.regionHint !== undefined && d.regionHint !== null) {
    if (!isValidRegionHint(d.regionHint) || !isUsableRegionArea(d.regionHint)) fail('invalid_input');
    regionHint = { points: d.regionHint.points.map((p) => ({ x: p.x, y: p.y })) };
  }
  return {
    idempotencyKey: d.idempotencyKey.toLowerCase(),
    photoPath: d.photoPath,
    goal: d.goal,
    styleId: d.styleId,
    density: d.density,
    quality: d.quality,
    regionHint,
    useFreeHighToken: optionalBoolean(d.useFreeHighToken),
    onboarding: optionalBoolean(d.onboarding),
  };
}

function previewIdOf(d: Data): string {
  const id = d.previewId;
  if (typeof id !== 'string' || !UUID_PATTERN.test(id)) fail('invalid_input');
  return id.toLowerCase();
}

export function parseCancelPreview(data: unknown): { previewId: string } {
  return { previewId: previewIdOf(asObject(data)) };
}

export function parseDeletePreview(data: unknown): { previewId: string } {
  return { previewId: previewIdOf(asObject(data)) };
}

export function parseReportPreview(data: unknown): { previewId: string; reason: ReportReason } {
  const d = asObject(data);
  const reason = d.reason;
  if (typeof reason !== 'string' || !(REPORT_REASONS as readonly string[]).includes(reason)) fail('invalid_input');
  return { previewId: previewIdOf(d), reason: reason as ReportReason };
}

export interface CohortInput {
  procedureDate: IsoDate;
  goal: Goal;
  kind: JourneyKind;
}

/** The operation day must be a real calendar date within a sane window (no future beyond a year, no ancient dates). */
export function parseJoinCohort(data: unknown, now: number = Date.now()): CohortInput {
  const d = asObject(data);
  if (!isIsoDate(d.procedureDate) || !isGoal(d.goal)) fail('invalid_input');
  if (!(JOURNEY_KINDS as readonly string[]).includes(d.kind as string)) fail('invalid_input');
  const day = Date.parse(`${d.procedureDate}T00:00:00Z`);
  const yearMs = 366 * 24 * 60 * 60 * 1000;
  if (day < now - 3 * yearMs || day > now + yearMs) fail('invalid_input');
  return { procedureDate: d.procedureDate, goal: d.goal, kind: d.kind as JourneyKind };
}
