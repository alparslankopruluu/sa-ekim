/**
 * Store review prompt policy (docs/playbooks/store-listing.md): never during onboarding,
 * never sentiment-gated, only after a genuine success moment — the 3rd logged progress photo
 * or the 2nd completed preview — at most once per 120 days (the OS also caps it at 3 per
 * 365 days), and only while the `ff_review_prompt` flag is on.
 */
import * as StoreReview from 'expo-store-review';

import { useSession } from '@/stores/session';

import { track } from './analytics';
import { remoteFlag } from './remoteConfig';

export const REVIEW_MIN_DAYS_BETWEEN = 120;
export const REVIEW_PHOTOS_THRESHOLD = 3;
export const REVIEW_PREVIEWS_THRESHOLD = 2;

type ReviewInputs = Pick<
  ReturnType<typeof useSession.getState>,
  'onboardingCompleted' | 'loggedPhotos' | 'completedPreviews' | 'lastReviewPromptAt'
>;

export function shouldAskForReview(state: ReviewInputs = useSession.getState(), now = Date.now()): boolean {
  if (!state.onboardingCompleted) return false;
  const successMoment =
    state.loggedPhotos >= REVIEW_PHOTOS_THRESHOLD || state.completedPreviews >= REVIEW_PREVIEWS_THRESHOLD;
  if (!successMoment) return false;
  if (state.lastReviewPromptAt && now - state.lastReviewPromptAt < REVIEW_MIN_DAYS_BETWEEN * 86_400_000) return false;
  return true;
}

/** Call right after the success moment happened (`photo` after a saved photo, `preview` after a result). */
export async function maybeAskForReview(trigger: 'photo' | 'preview'): Promise<void> {
  if (!remoteFlag('ff_review_prompt') || !shouldAskForReview()) return;
  if (!(await StoreReview.hasAction())) return;
  useSession.getState().markReviewPrompted();
  track('review_prompt', { trigger });
  await StoreReview.requestReview();
}
