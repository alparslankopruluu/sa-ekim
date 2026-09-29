import { shouldAskForReview } from '@/services/review';
import { useSession } from '@/stores/session';

jest.mock('expo-store-review', () => ({ hasAction: jest.fn(), requestReview: jest.fn() }));
jest.mock('@/services/analytics', () => ({ track: jest.fn() }));
jest.mock('@/services/remoteConfig', () => ({ remoteFlag: () => true }));

const DAY = 86_400_000;

describe('review prompt policy', () => {
  const base = { ...useSession.getState(), onboardingCompleted: true, shares: 0, completedRenders: 0, lastReviewPromptAt: null };

  it('never asks before a real success moment', () => {
    expect(shouldAskForReview({ ...base }, 0)).toBe(false);
    expect(shouldAskForReview({ ...base, shares: 2, onboardingCompleted: false }, 0)).toBe(false);
  });

  it('asks after two shares or three renders', () => {
    expect(shouldAskForReview({ ...base, shares: 2 }, 0)).toBe(true);
    expect(shouldAskForReview({ ...base, completedRenders: 3 }, 0)).toBe(true);
  });

  it('waits 120 days between prompts', () => {
    const now = 200 * DAY;
    expect(shouldAskForReview({ ...base, shares: 5, lastReviewPromptAt: now - 30 * DAY }, now)).toBe(false);
    expect(shouldAskForReview({ ...base, shares: 5, lastReviewPromptAt: now - 121 * DAY }, now)).toBe(true);
  });
});
