/**
 * The single gating matrix (spec §6). Screens never hardcode `isPro` checks: they ask
 * `canUse(feature, ctx)` and, when blocked, open the paywall with the returned source.
 *
 * Free  = care guide (phase `care`, days 0–14), shed log, 3 progress photos with the ghost
 *         overlay, one free preview, every preview style at standard quality paid in credits.
 * Pro   = unlimited photos, compare, expected-phase band, full guide, cohort, clinic report,
 *         phase reminders (care reminders stay free). HD is paid with credits/allowance, so it
 *         is never an entitlement gate.
 */
import { useCallback } from 'react';

import { FREE_LIMITS } from '@shared/pricing';
import type { PhaseId } from '@shared/timeline';

import type { PaywallSource } from '@/services/analytics';
import { useAccount } from '@/stores/account';

export const FEATURES = [
  'photos',
  'compare',
  'band',
  'guide',
  'report',
  'cohort',
  'hd',
  'phaseReminders',
] as const;
export type Feature = (typeof FEATURES)[number];

export interface EntitlementContext {
  isPro: boolean;
  /** Progress photos already saved (for `photos`: the new one is blocked at the limit). */
  photoCount?: number;
  /** Day index from the operation day (negative = before). Used by `guide` when no phase is known. */
  day?: number;
  /** Guide page being opened. */
  phaseId?: PhaseId;
}

export interface Gate {
  allowed: boolean;
  /** Where the paywall was opened from; null when the feature is allowed. */
  paywallSource: PaywallSource | null;
}

const ALLOWED: Gate = { allowed: true, paywallSource: null };

const LOCKED_SOURCE: Record<Exclude<Feature, 'hd'>, PaywallSource> = {
  photos: 'locked_photos',
  compare: 'locked_compare',
  band: 'locked_band',
  guide: 'locked_guide',
  report: 'locked_report',
  // The shared PaywallSource union has no dedicated sources for these two. The cohort card
  // lives on Today (home_banner); phase reminders are toggled in Settings.
  cohort: 'home_banner',
  phaseReminders: 'settings',
};

function locked(feature: Exclude<Feature, 'hd'>): Gate {
  return { allowed: false, paywallSource: LOCKED_SOURCE[feature] };
}

function guideIsFree(ctx: EntitlementContext): boolean {
  if (ctx.phaseId !== undefined) return ctx.phaseId === 'care';
  if (ctx.day !== undefined) return ctx.day <= FREE_LIMITS.freeGuideDays;
  return false;
}

export function canUse(feature: Feature, ctx: EntitlementContext): Gate {
  if (feature === 'hd') return ALLOWED;
  if (ctx.isPro) return ALLOWED;
  switch (feature) {
    case 'photos':
      return (ctx.photoCount ?? 0) < FREE_LIMITS.journeyPhotos ? ALLOWED : locked('photos');
    case 'guide':
      return guideIsFree(ctx) ? ALLOWED : locked('guide');
    default:
      return locked(feature);
  }
}

export interface EntitlementApi {
  isPro: boolean;
  /** `false` until the first entitlement snapshot arrived (avoid flashing lock icons). */
  loaded: boolean;
  canUse(feature: Feature, ctx?: Omit<EntitlementContext, 'isPro'>): Gate;
}

/** Reads the mirrored RevenueCat entitlement; screens use `canUse` instead of checking `isPro`. */
export function useEntitlement(): EntitlementApi {
  const isPro = useAccount((s) => s.entitlement.isPro);
  const loaded = useAccount((s) => s.entitlementLoaded);
  const check = useCallback(
    (feature: Feature, ctx: Omit<EntitlementContext, 'isPro'> = {}) => canUse(feature, { ...ctx, isPro }),
    [isPro],
  );
  return { isPro, loaded, canUse: check };
}
