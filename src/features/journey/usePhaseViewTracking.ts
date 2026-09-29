import { useEffect } from 'react';

import { track } from '@/services/analytics';

import { useJourneyLocal } from './localState';
import type { JourneyView } from './useJourneyView';

/** Reports `phase_view` at most once per phase per calendar day (survives app restarts). */
export function usePhaseViewTracking(view: JourneyView): void {
  const phaseId = view.kind === 'transplant' && view.clock.status === 'active' ? view.clock.phase.id : null;
  const day = view.clock.status === 'active' ? view.clock.day : 0;
  const today = view.todayIso;

  useEffect(() => {
    if (!phaseId) return;
    const key = `${phaseId}:${today}`;
    const run = () => {
      const store = useJourneyLocal.getState();
      if (store.phaseViewKey === key) return;
      store.markPhaseViewed(key);
      track('phase_view', { phase: phaseId, day });
    };
    if (useJourneyLocal.persist.hasHydrated()) {
      run();
      return;
    }
    return useJourneyLocal.persist.onFinishHydration(run);
  }, [phaseId, today, day]);
}
