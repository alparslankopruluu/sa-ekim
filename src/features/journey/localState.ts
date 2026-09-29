/**
 * Small persisted UI state that belongs to the journey screens only: which items of the
 * first-fortnight care checklist were ticked on which day, and the last `phase_view` that was
 * reported (so the event fires once per phase per day, not on every launch).
 *
 * Device-local, secret-free. It clears itself when the journey is wiped (operation date
 * back to null), which is what Settings → "Delete all my data" does.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { IsoDate } from '@shared/timeline';

import { useJourney } from '@/stores/journey';

export const CARE_ITEMS = ['wash', 'sleep', 'hands', 'sun'] as const;
export type CareItem = (typeof CARE_ITEMS)[number];

const KEEP_DAYS = 21;

interface LocalState {
  care: Record<IsoDate, CareItem[]>;
  phaseViewKey: string | null;
  toggleCare(date: IsoDate, item: CareItem): void;
  markPhaseViewed(key: string): void;
  reset(): void;
}

export const useJourneyLocal = create<LocalState>()(
  persist(
    (set, get) => ({
      care: {},
      phaseViewKey: null,
      toggleCare: (date, item) => {
        const current = get().care[date] ?? [];
        const next = current.includes(item) ? current.filter((i) => i !== item) : [...current, item];
        const care = { ...get().care, [date]: next };
        const dates = Object.keys(care).sort();
        for (const old of dates.slice(0, Math.max(0, dates.length - KEEP_DAYS))) delete care[old];
        set({ care });
      },
      markPhaseViewed: (key) => set({ phaseViewKey: key }),
      reset: () => set({ care: {}, phaseViewKey: null }),
    }),
    {
      name: 'kok.journey.local.v1',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

// A wiped journey (date back to null) also forgets the checklist ticks.
useJourney.subscribe((state, previous) => {
  if (previous.procedureDate !== null && state.procedureDate === null) useJourneyLocal.getState().reset();
});
