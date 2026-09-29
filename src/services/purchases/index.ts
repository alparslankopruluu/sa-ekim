/**
 * PurchasesService — the single entry point for purchases, entitlement and
 * offerings (AGENTS.md §4). RevenueCat when public SDK keys exist, else the
 * mock store. Every fetch is bounded so a paywall never spins forever.
 */
import { OFFERINGS, type OfferingId } from '@shared/products';

import i18n from '@/lib/i18n';
import { useAccount } from '@/stores/account';

import { track } from '../analytics';
import { backendMode, getBackend } from '../backend';
import { withTimeout } from '../backend/errors';
import { BackendError } from '../backend/types';
import { recordNonFatal } from '../crash';
import { createMockStore } from './mockStore';
import { createRevenueCatAdapter } from './revenuecat';
import type {
  CreditPackOption,
  EntitlementState,
  PackageRef,
  PaywallOffer,
  PlanOption,
  PurchaseOutcome,
  PurchasesAdapter,
} from './types';
import { NO_ENTITLEMENT } from './types';

export * from './types';

const OFFER_TIMEOUT_MS = 10000;
const OFFER_CACHE_MS = 5 * 60 * 1000;

let adapter: PurchasesAdapter | null = null;
let unsubscribe: (() => void) | null = null;
const offerCache = new Map<string, { at: number; promise: Promise<PaywallOffer> }>();

/**
 * Live builds without a store key must never fall back to the mock store (it
 * "sells" Pro without charging). The store simply reports itself unavailable.
 */
function createUnavailableStore(): PurchasesAdapter {
  const unavailable = () => Promise.reject(new BackendError('provider_failed'));
  return {
    kind: 'revenuecat',
    configure: () => undefined,
    logIn: async () => undefined,
    getOffer: unavailable,
    getCreditPacks: unavailable,
    purchase: unavailable,
    restore: unavailable,
    getEntitlement: async () => NO_ENTITLEMENT,
    onEntitlementChange: () => () => undefined,
  };
}

function getAdapter(): PurchasesAdapter {
  if (!adapter) {
    adapter =
      createRevenueCatAdapter() ??
      (backendMode === 'live' ? createUnavailableStore() : createMockStore(() => i18n.language || 'en'));
  }
  return adapter;
}

function publish(state: EntitlementState): void {
  useAccount.getState().setEntitlement(state);
}

export const purchases = {
  get kind(): 'mock' | 'revenuecat' {
    return getAdapter().kind;
  },

  /** Configure at app root before any paywall can render (docs/playbooks/paywall.md). */
  configure(): void {
    getAdapter().configure();
  },

  /** RevenueCat app_user_id == Firebase uid (webhook → Firestore joins). */
  async logIn(uid: string): Promise<void> {
    const a = getAdapter();
    try {
      await withTimeout(a.logIn(uid), 15000);
    } catch (error) {
      recordNonFatal(error, 'purchases_login');
    }
    unsubscribe?.();
    unsubscribe = a.onEntitlementChange(publish);
    publish(await a.getEntitlement());
    if (a.setAnalyticsInstanceId) {
      // RevenueCat → Firebase Analytics integration needs the Firebase app instance id.
      const instanceId = await getBackend().analytics.getAppInstanceId();
      if (instanceId) a.setAnalyticsInstanceId(instanceId).catch(() => undefined);
    }
  },

  /** Bounded offer fetch with a short-lived cache (prefetched at onboarding start). */
  loadOffer(offeringId: OfferingId = OFFERINGS.default, options: { force?: boolean } = {}): Promise<PaywallOffer> {
    const cached = offerCache.get(offeringId);
    if (cached && !options.force && Date.now() - cached.at < OFFER_CACHE_MS) return cached.promise;
    const promise = withTimeout(getAdapter().getOffer(offeringId), OFFER_TIMEOUT_MS).then((offer) => {
      if (!offer) throw new BackendError('not_found');
      return offer;
    });
    offerCache.set(offeringId, { at: Date.now(), promise });
    promise.catch(() => offerCache.delete(offeringId));
    return promise;
  },

  prefetch(): void {
    purchases.loadOffer(OFFERINGS.default).catch(() => undefined);
  },

  loadCreditPacks(): Promise<CreditPackOption[]> {
    return withTimeout(getAdapter().getCreditPacks(), OFFER_TIMEOUT_MS);
  },

  async buyPlan(plan: PlanOption): Promise<PurchaseOutcome> {
    const ref: PackageRef = { offeringId: plan.offeringId, packageId: plan.packageId };
    try {
      const outcome = await getAdapter().purchase(ref);
      if (outcome.status === 'purchased') {
        if (outcome.isTrial) track('trial_start', { package: plan.id });
        track('purchase', { package: plan.id, kind: 'subscription', is_renewal: false });
        publish(await getAdapter().getEntitlement());
      } else if (outcome.status === 'cancelled') {
        track('purchase_cancelled', { package: plan.id });
      }
      return outcome;
    } catch (error) {
      const code = error instanceof BackendError ? error.code : 'unknown';
      track('purchase_failed', { package: plan.id, reason: code });
      recordNonFatal(error, 'purchase_plan');
      throw error instanceof BackendError ? error : new BackendError('provider_failed');
    }
  },

  async buyCredits(pack: CreditPackOption): Promise<PurchaseOutcome> {
    try {
      const outcome = await getAdapter().purchase({ offeringId: OFFERINGS.credits, packageId: pack.packageId });
      if (outcome.status === 'purchased') track('purchase', { package: pack.id, kind: 'credits', is_renewal: false });
      if (outcome.status === 'cancelled') track('purchase_cancelled', { package: pack.id });
      return outcome;
    } catch (error) {
      const code = error instanceof BackendError ? error.code : 'unknown';
      track('purchase_failed', { package: pack.id, reason: code });
      recordNonFatal(error, 'purchase_credits');
      throw error instanceof BackendError ? error : new BackendError('provider_failed');
    }
  },

  async restore(): Promise<EntitlementState> {
    const state = await withTimeout(getAdapter().restore(), 30000);
    publish(state);
    track('restore_result', { restored: state.isPro });
    return state;
  },
};
