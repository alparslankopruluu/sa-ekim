import { REVIEW_PHOTOS_THRESHOLD, REVIEW_PREVIEWS_THRESHOLD, shouldAskForReview } from '@/services/review';

jest.mock('expo-store-review', () => ({ hasAction: jest.fn(), requestReview: jest.fn() }));
jest.mock('@/services/analytics', () => ({ track: jest.fn() }));
jest.mock('@/services/remoteConfig', () => ({ remoteFlag: () => true }));

const DAY = 86_400_000;

describe('review prompt policy', () => {
  const base = { onboardingCompleted: true, loggedPhotos: 0, completedPreviews: 0, lastReviewPromptAt: null };

  it('never asks before a real success moment or during onboarding', () => {
    expect(shouldAskForReview({ ...base }, 0)).toBe(false);
    expect(shouldAskForReview({ ...base, loggedPhotos: 5, onboardingCompleted: false }, 0)).toBe(false);
    expect(shouldAskForReview({ ...base, loggedPhotos: REVIEW_PHOTOS_THRESHOLD - 1 }, 0)).toBe(false);
  });

  it('asks after the 3rd logged photo or the 2nd completed preview', () => {
    expect(shouldAskForReview({ ...base, loggedPhotos: REVIEW_PHOTOS_THRESHOLD }, 0)).toBe(true);
    expect(shouldAskForReview({ ...base, completedPreviews: REVIEW_PREVIEWS_THRESHOLD }, 0)).toBe(true);
  });

  it('waits 120 days between prompts', () => {
    const now = 200 * DAY;
    expect(shouldAskForReview({ ...base, loggedPhotos: 9, lastReviewPromptAt: now - 30 * DAY }, now)).toBe(false);
    expect(shouldAskForReview({ ...base, loggedPhotos: 9, lastReviewPromptAt: now - 121 * DAY }, now)).toBe(true);
  });
});
