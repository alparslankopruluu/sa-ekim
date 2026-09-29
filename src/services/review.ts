/**
 * Store review prompt policy (docs/playbooks/store-listing.md): never in
 * onboarding, never sentiment-gated, only after a genuine success moment,
 * at most once per 120 days (the OS also caps it at 3/365 days).
 */
import * as StoreReview from 'expo-store-review';

import { useSession } from '@/stores/session';

import { track } from './analytics';
import { remoteFlag } from './remoteConfig';

const MIN_DAYS_BETWEEN = 120;

export function shouldAskForReview(state = useSession.getState(), now = Date.now()): boolean {
  if (!state.onboardingCompleted) return false;
  const successMoments = state.shares >= 2 || state.completedRenders >= 3;
  if (!successMoments) return false;
  if (state.lastReviewPromptAt && now - state.lastReviewPromptAt < MIN_DAYS_BETWEEN * 86400000) return false;
  return true;
}

export async function maybeAskForReview(trigger: 'share' | 'render'): Promise<void> {
  if (!remoteFlag('ff_review_prompt') || !shouldAskForReview()) return;
  if (!(await StoreReview.hasAction())) return;
  useSession.getState().markReviewPrompted();
  track('review_prompt', { trigger });
  await StoreReview.requestReview();
}
