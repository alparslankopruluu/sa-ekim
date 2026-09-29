/**
 * What happens after "Use photo". Journey mode stores the file and the store entry, counts
 * the photo, logs `photo_captured`, rebuilds reminders and may ask for a review. Preview mode
 * never touches the journey: it only hands the photo (and the guide's region hint) to the
 * in-memory preview draft.
 */
import type { Angle, Goal } from '@shared/catalog';
import { dayIndex } from '@shared/timeline';

import { canUse } from '@/lib/entitlements';
import { track } from '@/services/analytics';
import { recordNonFatal } from '@/services/crash';
import { saveJourneyPhoto } from '@/services/journeyFiles';
import { scheduleJourneyReminders } from '@/services/notifications';
import { maybeAskForReview } from '@/services/review';
import { useAccount } from '@/stores/account';
import { useJourney } from '@/stores/journey';
import { usePreviewDraft } from '@/stores/previewDraft';
import { useSession } from '@/stores/session';

import { regionHintFor } from './guide';

export type CaptureSource = 'camera' | 'library';

/** The free-photo gate at this moment (journey mode). */
export function photoGate() {
  return canUse('photos', {
    isPro: useAccount.getState().entitlement.isPro,
    photoCount: useJourney.getState().photos.length,
  });
}

export async function commitJourneyPhoto(input: {
  uri: string;
  angle: Angle;
  source: CaptureSource;
  ghost: boolean;
  now?: Date;
}): Promise<string> {
  const now = input.now ?? new Date();
  const saved = await saveJourneyPhoto(input.uri);
  useJourney.getState().addPhoto({ id: saved.id, uri: saved.uri, takenAt: now.getTime(), angle: input.angle });
  useSession.getState().recordPhotoLogged();
  const procedureDate = useJourney.getState().procedureDate;
  track('photo_captured', {
    angle: input.angle,
    day: procedureDate ? dayIndex(procedureDate, now) : -1,
    ghost: input.ghost,
    source: input.source,
  });
  // Side effects that must never block or fail the save.
  void scheduleJourneyReminders().catch((error: unknown) => recordNonFatal(error, 'reschedule_after_photo'));
  void maybeAskForReview('photo').catch(() => undefined);
  return saved.id;
}

export function commitPreviewPhoto(input: { uri: string; angle: Angle; goal: Goal; source: CaptureSource }): void {
  usePreviewDraft.getState().setPhoto({
    localUri: input.uri,
    storagePath: null,
    source: input.source,
    // Library photos were not framed with the guide, so they carry no hint.
    regionHint: input.source === 'camera' ? regionHintFor(input.angle, input.goal) : undefined,
  });
  track('photo_selected', { source: input.source });
}
