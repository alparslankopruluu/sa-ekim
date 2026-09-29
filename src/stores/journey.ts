/**
 * The user's journey, device-local: operation date, progress photos, shed log and PRP
 * sessions. Persisted on AsyncStorage; photo files live under `documentDirectory/journey/`
 * (see services/journeyFiles.ts). Nothing here is uploaded — iOS device backup and Android
 * Auto Backup cover both the store and the files.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Angle, JourneyKind } from '@shared/catalog';
import { MAX_SHED_COUNT } from '@shared/catalog';
import { type IsoDate, isIsoDate } from '@shared/timeline';

export interface JourneyPhoto {
  id: string;
  /** Local file URI (file://…/journey/<id>.jpg). */
  uri: string;
  /** Epoch ms when the photo was taken; the day index is derived from the operation date. */
  takenAt: number;
  angle: Angle;
}

export interface ShedEntry {
  date: IsoDate;
  count: number;
}

export interface PrpSession {
  id: string;
  date: IsoDate;
  done: boolean;
}

interface JourneyState {
  hydrated: boolean;
  kind: JourneyKind;
  /** Operation day (transplant) or first session day (PRP); null until the user sets it. */
  procedureDate: IsoDate | null;
  clinicName: string | null;
  photos: JourneyPhoto[];
  shed: ShedEntry[];
  prpSessions: PrpSession[];
  cohortJoined: boolean;
  /** Notification ids scheduled for this journey, so they can be cancelled and rebuilt. */
  scheduledNotificationIds: string[];

  setHydrated(): void;
  setKind(kind: JourneyKind): void;
  setProcedureDate(date: IsoDate | null): void;
  setClinicName(name: string | null): void;
  addPhoto(photo: JourneyPhoto): void;
  removePhoto(id: string): void;
  upsertShed(entry: ShedEntry): void;
  removeShed(date: IsoDate): void;
  setPrpSessions(sessions: PrpSession[]): void;
  togglePrpSession(id: string): void;
  setCohortJoined(joined: boolean): void;
  setScheduledNotificationIds(ids: string[]): void;
  wipe(): void;
}

const initial = {
  kind: 'transplant' as JourneyKind,
  procedureDate: null as IsoDate | null,
  clinicName: null as string | null,
  photos: [] as JourneyPhoto[],
  shed: [] as ShedEntry[],
  prpSessions: [] as PrpSession[],
  cohortJoined: false,
  scheduledNotificationIds: [] as string[],
};

export const useJourney = create<JourneyState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      ...initial,
      setHydrated: () => set({ hydrated: true }),
      setKind: (kind) => set({ kind }),
      setProcedureDate: (date) => {
        if (date !== null && !isIsoDate(date)) return;
        set({ procedureDate: date });
      },
      setClinicName: (name) => set({ clinicName: name && name.trim() ? name.trim() : null }),
      addPhoto: (photo) =>
        set({ photos: [...get().photos.filter((p) => p.id !== photo.id), photo].sort((a, b) => a.takenAt - b.takenAt) }),
      removePhoto: (id) => set({ photos: get().photos.filter((p) => p.id !== id) }),
      upsertShed: (entry) => {
        if (!isIsoDate(entry.date)) return;
        const count = Math.min(MAX_SHED_COUNT, Math.max(0, Math.round(entry.count)));
        set({
          shed: [...get().shed.filter((s) => s.date !== entry.date), { date: entry.date, count }].sort((a, b) =>
            a.date.localeCompare(b.date),
          ),
        });
      },
      removeShed: (date) => set({ shed: get().shed.filter((s) => s.date !== date) }),
      setPrpSessions: (sessions) => set({ prpSessions: sessions }),
      togglePrpSession: (id) =>
        set({ prpSessions: get().prpSessions.map((s) => (s.id === id ? { ...s, done: !s.done } : s)) }),
      setCohortJoined: (cohortJoined) => set({ cohortJoined }),
      setScheduledNotificationIds: (ids) => set({ scheduledNotificationIds: ids }),
      wipe: () => set({ ...initial }),
    }),
    {
      name: 'kok.journey.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ hydrated: _hydrated, ...rest }) => rest,
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);
