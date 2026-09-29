/**
 * Persisted, device-local session state: onboarding answers, consent, prefs,
 * review-prompt bookkeeping. No secrets and no photos (those live in stores/journey.ts
 * and the journey files directory).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Goal, Stage } from '@shared/catalog';

/** Bump when the AI-processing disclosure changes (it names the AI providers). */
export const CONSENT_VERSION = 1;

export interface Preferences {
  haptics: boolean;
  /** Push/local: "your preview is ready". */
  notifyPreviews: boolean;
  /** Remote campaign pushes (offers). */
  notifyOffers: boolean;
  /** Local journey reminders: phase changes, weekly photo, first-14-days care. */
  notifyReminders: boolean;
}

interface SessionState {
  hydrated: boolean;
  onboardingCompleted: boolean;
  onboardingStartedAt: number | null;
  goal: Goal | null;
  stage: Stage | null;
  consentVersion: number;
  notificationsPrompted: boolean;
  completedPreviews: number;
  shares: number;
  loggedPhotos: number;
  lastReviewPromptAt: number | null;
  seenResults: string[];
  giftNotificationId: string | null;
  preferences: Preferences;

  setHydrated(): void;
  startOnboarding(): void;
  setGoal(goal: Goal): void;
  setStage(stage: Stage): void;
  completeOnboarding(): void;
  replayOnboarding(): void;
  acceptConsent(version: number): void;
  markNotificationsPrompted(): void;
  recordPreviewCompleted(): void;
  recordShare(): void;
  recordPhotoLogged(): void;
  markReviewPrompted(): void;
  markResultSeen(previewId: string): boolean;
  setGiftNotification(id: string | null): void;
  setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]): void;
  resetAll(): void;
}

const DEFAULT_PREFERENCES: Preferences = {
  haptics: true,
  notifyPreviews: true,
  notifyOffers: true,
  notifyReminders: true,
};

const initial = {
  onboardingCompleted: false,
  onboardingStartedAt: null,
  goal: null,
  stage: null,
  consentVersion: 0,
  notificationsPrompted: false,
  completedPreviews: 0,
  shares: 0,
  loggedPhotos: 0,
  lastReviewPromptAt: null,
  seenResults: [] as string[],
  giftNotificationId: null,
  preferences: DEFAULT_PREFERENCES,
};

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      ...initial,
      setHydrated: () => set({ hydrated: true }),
      startOnboarding: () => {
        if (!get().onboardingStartedAt) set({ onboardingStartedAt: Date.now() });
      },
      setGoal: (goal) => set({ goal }),
      setStage: (stage) => set({ stage }),
      completeOnboarding: () => set({ onboardingCompleted: true }),
      replayOnboarding: () => set({ onboardingCompleted: false, onboardingStartedAt: null }),
      acceptConsent: (version) => set({ consentVersion: version }),
      markNotificationsPrompted: () => set({ notificationsPrompted: true }),
      recordPreviewCompleted: () => set({ completedPreviews: get().completedPreviews + 1 }),
      recordShare: () => set({ shares: get().shares + 1 }),
      recordPhotoLogged: () => set({ loggedPhotos: get().loggedPhotos + 1 }),
      markReviewPrompted: () => set({ lastReviewPromptAt: Date.now() }),
      markResultSeen: (previewId) => {
        if (get().seenResults.includes(previewId)) return false;
        set({ seenResults: [previewId, ...get().seenResults].slice(0, 200) });
        return true;
      },
      setGiftNotification: (id) => set({ giftNotificationId: id }),
      setPreference: (key, value) => set({ preferences: { ...get().preferences, [key]: value } }),
      resetAll: () => set({ ...initial }),
    }),
    {
      name: 'kok.session.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ hydrated: _hydrated, ...rest }) => rest,
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);
