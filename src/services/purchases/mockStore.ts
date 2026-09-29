/**
 * Mock store used until the RevenueCat public SDK keys are configured (mock mode only —
 * live builds never fall back to it). Prices mirror the owner-fixed price points
 * (PRODUCT.md: weekly 7.99, monthly 12.99, annual 39.99, gift annual 23.99 first year,
 * packs 4.99 / 9.99 / 19.99; NO free trial anywhere) and are formatted like real
 * storefront price strings. Developer switches exercise every paywall state (slow,
 * failed, empty, cancel, error) and a couple of storefront currencies for layout checks.
 * Entitlement and credits come from the mock server, exactly like the RevenueCat webhook.
 */
import * as Crypto from 'expo-crypto';

import { CREDIT_PACKS, type CreditPackId } from '@shared/pricing';
import { OFFERINGS, type OfferingId, PACKAGES, type PlanId, PRODUCT_SUFFIXES } from '@shared/products';

import { mockServer } from '../backend/mock/mockServer';
import { BackendError } from '../backend/types';
import { formatCurrency } from './format';
import {
  type CreditPackOption,
  type EntitlementState,
  NO_ENTITLEMENT,
  type PackageRef,
  type PaywallOffer,
  type PlanOption,
  type PurchaseOutcome,
  type PurchasesAdapter,
} from './types';

export type MockStorefront = 'USD' | 'TRY' | 'SAR';

export interface MockStoreFlags {
  offerings: 'ok' | 'slow' | 'fail' | 'empty';
  purchase: 'success' | 'cancel' | 'fail';
  /** Currency the mock storefront sells in (layout checks with long price strings). */
  storefront: MockStorefront;
  /** Show the gift offering even without a won discount (developer preview of the gift paywall). */
  unlockGiftOffer: boolean;
}

export const mockStoreFlags: MockStoreFlags = {
  offerings: 'ok',
  purchase: 'success',
  storefront: 'USD',
  unlockGiftOffer: false,
};

interface PriceTable {
  weekly: number;
  monthly: number;
  annual: number;
  annualGift: number;
  credits_10: number;
  credits_25: number;
  credits_60: number;
}

/**
 * USD is the owner-fixed reference tier. TRY and SAR are placeholder tiers that exist only in
 * this mock to check layouts with longer price strings; real tiers are set in App Store
 * Connect / Play at catalog time.
 */
const PRICE_TABLES: Record<MockStorefront, PriceTable> = {
  USD: { weekly: 7.99, monthly: 12.99, annual: 39.99, annualGift: 23.99, credits_10: 4.99, credits_25: 9.99, credits_60: 19.99 },
  TRY: { weekly: 249.99, monthly: 399.99, annual: 1299.99, annualGift: 779.99, credits_10: 149.99, credits_25: 299.99, credits_60: 599.99 },
  SAR: { weekly: 29.99, monthly: 49.99, annual: 149.99, annualGift: 89.99, credits_10: 18.99, credits_25: 37.99, credits_60: 74.99 },
};

export const MOCK_BUNDLE_ID = 'com.techtactoe.kok';

const PERIOD: Record<PlanId, PlanOption['period']> = { weekly: 'week', monthly: 'month', annual: 'year' };
const PLAN_PACKAGE: Record<PlanId, string> = {
  weekly: PACKAGES.weekly,
  monthly: PACKAGES.monthly,
  annual: PACKAGES.annual,
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createMockStore(getLocale: () => string): PurchasesAdapter {
  const listeners = new Set<(state: EntitlementState) => void>();
  const table = () => PRICE_TABLES[mockStoreFlags.storefront];
  const price = (amount: number) => formatCurrency(amount, mockStoreFlags.storefront, getLocale());

  const entitlement = (): EntitlementState => {
    const info = mockServer.proInfo;
    if (!info.active) return { ...NO_ENTITLEMENT };
    return { isPro: true, productId: info.productId, willRenew: true, expiresAt: info.expiresAt, isTrial: false };
  };

  const plan = (offeringId: OfferingId, id: PlanId, gift = false): PlanOption => {
    const prices = table();
    const amount = prices[id];
    const suffix = gift ? PRODUCT_SUFFIXES.annualGiftDiscount : PRODUCT_SUFFIXES[id];
    return {
      id,
      offeringId,
      packageId: PLAN_PACKAGE[id],
      productId: `${MOCK_BUNDLE_ID}.${suffix}`,
      priceString: price(amount),
      price: amount,
      currencyCode: mockStoreFlags.storefront,
      period: PERIOD[id],
      introPriceString: gift ? price(prices.annualGift) : null,
      introPrice: gift ? prices.annualGift : null,
    };
  };

  const offers: Record<string, () => PaywallOffer | null> = {
    [OFFERINGS.default]: () => ({
      offeringId: OFFERINGS.default,
      plans: [
        plan(OFFERINGS.default, 'annual'),
        plan(OFFERINGS.default, 'monthly'),
        plan(OFFERINGS.default, 'weekly'),
      ],
    }),
    [OFFERINGS.giftDiscount]: () =>
      mockServer.giftOfferActive || mockStoreFlags.unlockGiftOffer
        ? {
            offeringId: OFFERINGS.giftDiscount,
            plans: [plan(OFFERINGS.giftDiscount, 'annual', true)],
          }
        : null,
  };

  const emit = (state: EntitlementState) => listeners.forEach((listener) => listener({ ...state }));
  mockServer.watchPro(() => emit(entitlement()));

  const simulateNetwork = async () => {
    if (mockStoreFlags.offerings === 'slow') await wait(12000);
    else await wait(450);
    if (mockStoreFlags.offerings === 'fail') throw new BackendError('offline');
  };

  const packs = (): CreditPackOption[] =>
    CREDIT_PACKS.map(
      (pack): CreditPackOption => ({
        id: pack.id as CreditPackId,
        credits: pack.credits,
        packageId: pack.id,
        productId: `${MOCK_BUNDLE_ID}.${pack.id}`,
        priceString: price(table()[pack.id]),
        price: table()[pack.id],
        currencyCode: mockStoreFlags.storefront,
      }),
    );

  return {
    kind: 'mock',
    configure() {},
    async logIn() {
      await mockServer.ready();
      emit(entitlement());
    },
    async getOffer(offeringId) {
      await simulateNetwork();
      if (mockStoreFlags.offerings === 'empty') return null;
      return offers[offeringId]?.() ?? null;
    },
    async getCreditPacks() {
      await simulateNetwork();
      if (mockStoreFlags.offerings === 'empty') return [];
      return packs();
    },
    async purchase(ref: PackageRef): Promise<PurchaseOutcome> {
      await wait(1100);
      await mockServer.ready();
      if (mockStoreFlags.purchase === 'cancel') return { status: 'cancelled' };
      if (mockStoreFlags.purchase === 'fail') throw new BackendError('provider_failed');
      const transactionId = Crypto.randomUUID();
      const pack = ref.offeringId === OFFERINGS.credits ? packs().find((p) => p.packageId === ref.packageId) : undefined;
      if (pack) {
        mockServer.grantPurchase(transactionId, pack.productId);
        return { status: 'purchased', productId: pack.productId, transactionId };
      }
      const chosen = offers[ref.offeringId]?.()?.plans.find((p) => p.packageId === ref.packageId);
      if (!chosen) throw new BackendError('not_found');
      mockServer.grantPurchase(transactionId, chosen.productId);
      return { status: 'purchased', productId: chosen.productId, transactionId };
    },
    async restore() {
      await wait(900);
      await mockServer.ready();
      const state = entitlement();
      emit(state);
      return state;
    },
    async getEntitlement() {
      await mockServer.ready();
      return entitlement();
    },
    onEntitlementChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
