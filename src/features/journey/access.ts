/**
 * The journey screens' only doorway to the gating matrix in `@/lib/entitlements`. Screens ask
 * these helpers instead of checking `isPro`, and open the paywall through `openPaywall` so the
 * source and the `feature_locked` analytics event always travel together.
 */
import { router } from 'expo-router';
import { useCallback } from 'react';

import type { Angle } from '@shared/catalog';
import type { PhaseId } from '@shared/timeline';

import { useEntitlement } from '@/lib/entitlements';
import { type LockedFeature, type PaywallSource, track } from '@/services/analytics';
import { useJourney } from '@/stores/journey';

export function openPaywall(source: PaywallSource, feature?: LockedFeature): void {
  if (feature) track('feature_locked', { feature });
  router.push({ pathname: '/paywall', params: { source } });
}

export function useJourneyAccess() {
  const { isPro, loaded, canUse } = useEntitlement();
  return {
    isPro,
    loaded,
    band: canUse('band'),
    guide: (phaseId: PhaseId) => canUse('guide', { phaseId }),
    photos: (photoCount: number) => canUse('photos', { photoCount }),
  };
}

/** Opens the capture screen for `angle`, or the paywall when the free photo limit is reached. */
export function useStartCapture(): (angle: Angle) => void {
  const { photos } = useJourneyAccess();
  return useCallback(
    (angle: Angle) => {
      const gate = photos(useJourney.getState().photos.length);
      if (!gate.allowed) {
        openPaywall(gate.paywallSource ?? 'locked_photos', 'photos');
        return;
      }
      router.push({ pathname: '/capture', params: { angle, mode: 'journey' } });
    },
    [photos],
  );
}
