/**
 * Preview service — every paid AI step goes through the server (security S1): the app
 * uploads the selfie and calls Functions; it never holds a provider key.
 */
import * as Crypto from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

import {
  CALLABLES,
  type CancelPreviewRequest,
  type CohortStats,
  type CreatePreviewRequest,
  type CreatePreviewResponse,
  type DeletePreviewRequest,
  type JoinCohortRequest,
  type RecordConsentRequest,
  type ReportPreviewRequest,
  type ReportReason,
} from '@shared/api';

import { CONSENT_VERSION, useSession } from '@/stores/session';

import { getBackend } from './backend';
import { BackendError } from './backend/types';
import { breadcrumb } from './crash';

/** Client timeouts sit above each Function's own timeoutSeconds (functions/src/callables). */
const TIMEOUTS = {
  consent: 15000,
  preview: 90000,
  cancel: 30000,
  delete: 30000,
  report: 15000,
  cohort: 20000,
} as const;

/** Longest edge sent to the provider — enough detail for a hairline, quick to upload. */
const MAX_PHOTO_EDGE = 1536;

export function newIdempotencyKey(): string {
  return Crypto.randomUUID();
}

function requireUid(): Promise<string> {
  return getBackend().auth.ensureSignedIn();
}

export function hasConsent(): boolean {
  return useSession.getState().consentVersion >= CONSENT_VERSION;
}

export async function recordConsent(): Promise<void> {
  await requireUid();
  await getBackend().functions.call<RecordConsentRequest, { ok: true }>(
    CALLABLES.recordConsent,
    { version: CONSENT_VERSION },
    TIMEOUTS.consent,
  );
  useSession.getState().acceptConsent(CONSENT_VERSION);
}

/** Downscales + re-encodes as JPEG (also strips EXIF/location metadata) before upload. */
async function preparePhoto(localUri: string): Promise<string> {
  if (Platform.OS === 'web') return localUri;
  try {
    const context = ImageManipulator.manipulate(localUri);
    context.resize({ width: MAX_PHOTO_EDGE });
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ compress: 0.86, format: SaveFormat.JPEG });
    return saved.uri;
  } catch {
    return localUri;
  }
}

/** Uploads the selfie for a preview. Needs consent; never called for journey photos. */
export async function uploadPhoto(localUri: string): Promise<string> {
  if (!hasConsent()) throw new BackendError('consent_required');
  const uid = await requireUid();
  const prepared = await preparePhoto(localUri);
  breadcrumb('upload_photo');
  return getBackend().storage.uploadUserFile(uid, prepared, 'photo', 'image/jpeg');
}

export function createPreview(request: Omit<CreatePreviewRequest, 'idempotencyKey'>, idempotencyKey: string) {
  breadcrumb('create_preview');
  return getBackend().functions.call<CreatePreviewRequest, CreatePreviewResponse>(
    CALLABLES.createPreview,
    { ...request, idempotencyKey },
    TIMEOUTS.preview,
  );
}

export function cancelPreview(previewId: string) {
  breadcrumb('cancel_preview');
  return getBackend().functions.call<CancelPreviewRequest, { canceled: boolean }>(
    CALLABLES.cancelPreview,
    { previewId },
    TIMEOUTS.cancel,
  );
}

export function deletePreview(previewId: string) {
  breadcrumb('delete_preview');
  return getBackend().functions.call<DeletePreviewRequest, { deleted: true }>(
    CALLABLES.deletePreview,
    { previewId },
    TIMEOUTS.delete,
  );
}

export function reportPreview(previewId: string, reason: ReportReason) {
  breadcrumb('report_preview');
  return getBackend().functions.call<ReportPreviewRequest, { reported: true }>(
    CALLABLES.reportPreview,
    { previewId, reason },
    TIMEOUTS.report,
  );
}

/** Opt-in: sends only the operation date, goal and kind (never photos). */
export function joinCohort(request: JoinCohortRequest) {
  breadcrumb('join_cohort');
  return getBackend().functions.call<JoinCohortRequest, { joined: true }>(
    CALLABLES.joinCohort,
    request,
    TIMEOUTS.cohort,
  );
}

export function getCohort() {
  return getBackend().functions.call<Record<string, never>, CohortStats>(CALLABLES.getCohort, {}, TIMEOUTS.cohort);
}

export function resolveMediaUrl(storagePath: string): Promise<string> {
  return getBackend().storage.resolveUrl(storagePath);
}
