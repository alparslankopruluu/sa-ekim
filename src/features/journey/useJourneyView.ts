import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import type { Goal } from '@shared/catalog';
import { toIsoDate } from '@shared/timeline';

import {
  journeyClock,
  type JourneyClock,
  lastPhotoDay,
  prpSummary,
  type PrpSummary,
} from '@/lib/phaseView';
import { useJourney } from '@/stores/journey';
import { useSession } from '@/stores/session';

/** Current time, refreshed when the app returns to the foreground or the screen regains focus. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(new Date());
    });
    return () => subscription.remove();
  }, []);
  useFocusEffect(useCallback(() => setNow(new Date()), []));
  return now;
}

/** Everything the journey screens derive from the stores, in one memoized snapshot. */
export function useJourneyView() {
  const hydrated = useJourney((s) => s.hydrated);
  const kind = useJourney((s) => s.kind);
  const procedureDate = useJourney((s) => s.procedureDate);
  const photos = useJourney((s) => s.photos);
  const shed = useJourney((s) => s.shed);
  const prpSessions = useJourney((s) => s.prpSessions);
  const sessionGoal = useSession((s) => s.goal);
  const goal: Goal = sessionGoal ?? 'hairline';
  const now = useNow();
  const todayIso = toIsoDate(now);

  return useMemo(() => {
    const clock: JourneyClock = journeyClock(procedureDate, now, goal);
    const prp: PrpSummary | null = kind === 'prp' ? prpSummary(prpSessions, todayIso) : null;
    return {
      hydrated,
      kind,
      goal,
      hasGoal: sessionGoal !== null,
      procedureDate,
      clock,
      photos,
      shed,
      prpSessions,
      prp,
      now,
      todayIso,
      lastPhotoDay: lastPhotoDay(photos, procedureDate),
      shedLoggedToday: shed.some((entry) => entry.date === todayIso),
    };
  }, [hydrated, kind, goal, sessionGoal, procedureDate, photos, shed, prpSessions, now, todayIso]);
}

export type JourneyView = ReturnType<typeof useJourneyView>;
