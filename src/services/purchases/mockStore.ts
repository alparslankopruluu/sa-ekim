/**
 * Mock store used until the RevenueCat public SDK keys are configured.
 * Prices mirror the proposed launch price points (PRODUCT.md) and are formatted
 * for the device locale exactly like real store price strings. Developer
 * switches exercise every paywall state (slow, failed, empty, cancel, error).
 */
import * as Crypto from 'expo-crypto';

import { CREDIT_PACKS, type CreditPackId } from '@shared/pricing';
import { OFFERINGS, type OfferingId, PACKAGES, PRODUCT_SUFFIXES } from '@shared/products';

import { BackendError } from '../backend/types';
import { mockServer } from '../backend/mock/mockServer';
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

export interface MockStoreFlags {
  offerings: 'ok' | 'slow' | 'fail' | 'empty';
  purchase: 'success' | 'cancel' | 'fail';
}

export const mockStoreFlags: MockStoreFlags = { offerings: 'ok', purchase: 'success' };

const CURRENCY = 'USD';
const BUNDLE = 'com.techtactoe.belto';

const PRICES = {
  weekly: 7.99,
  annual: 59.99,
  annualGift: 35.99,
  credits_100: 9.99,
  credits_300: 24.99,
  credits_800: 54.99,
} as const;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createMockStore(getLocale: () => string): PurchasesAdapter {
  let entitlement: EntitlementState = { ...NO_ENTITLEMENT };
  const listeners = new Set<(state: EntitlementState) => void>();
  const price = (amount: number) => formatCurrency(amount, CURRENCY, getLocale());

  const plan = (
    offeringId: OfferingId,
    id: 'weekly' | 'annual',
    options: { trialDays?: number; intro?: number } = {},
  ): PlanOption => {
    const amount = id === 'weekly' ? PRICES.weekly : PRICES.annual;
    const suffix =
      id === 'weekly'
        ? PRODUCT_SUFFIXES.weekly
        : offeringId === OFFERINGS.giftDiscount
          ? PRODUCT_SUFFIXES.annualGiftDiscount
          : offeringId === OFFERINGS.giftTrial
            ? PRODUCT_SUFFIXES.annualGiftTrial
            : PRODUCT_SUFFIXES.annual;
    return {
      id,
      offeringId,
      packageId: id === 'weekly' ? PACKAGES.weekly : PACKAGES.annual,
      productId: `${BUNDLE}.${suffix}`,
      priceString: price(amount),
      price: amount,
      currencyCode: CURRENCY,
      period: id === 'weekly' ? 'week' : 'year',
      trialDays: options.trialDays ?? null,
      introPriceString: options.intro !== undefined ? price(options.intro) : null,
      introPrice: options.intro ?? null,
    };
  };

  const offers: Record<string, () => PaywallOffer> = {
    [OFFERINGS.default]: () => ({
      offeringId: OFFERINGS.default,
      plans: [plan(OFFERINGS.default, 'annual', { trialDays: 3 }), plan(OFFERINGS.default, 'weekly')],
    }),
    [OFFERINGS.giftDiscount]: () => ({
      offeringId: OFFERINGS.giftDiscount,
      plans: [plan(OFFERINGS.giftDiscount, 'annual', { intro: PRICES.annualGift })],
    }),
    [OFFERINGS.giftTrial]: () => ({
      offeringId: OFFERINGS.giftTrial,
      plans: [plan(OFFERINGS.giftTrial, 'annual', { trialDays: 7 })],
    }),
  };

  const emit = () => listeners.forEach((listener) => listener({ ...entitlement }));

  const simulateNetwork = async () => {
    if (mockStoreFlags.offerings === 'slow') await wait(12000);
    else await wait(450);
    if (mockStoreFlags.offerings === 'fail') throw new BackendError('offline');
  };

  return {
    kind: 'mock',
    configure() {},
    async logIn() {
      await mockServer.ready();
      entitlement = mockServer.isPro ? { ...entitlement, isPro: true } : entitlement;
      emit();
    },
    async getOffer(offeringId) {
      await simulateNetwork();
      if (mockStoreFlags.offerings === 'empty') return null;
      const build = offers[offeringId];
      return build ? build() : null;
    },
    async getCreditPacks() {
      await simulateNetwork();
      if (mockStoreFlags.offerings === 'empty') return [];
      return CREDIT_PACKS.map(
        (pack): CreditPackOption => ({
          id: pack.id as CreditPackId,
          credits: pack.credits,
          packageId: pack.id,
          productId: `${BUNDLE}.${pack.id}`,
          priceString: price(PRICES[pack.id]),
          price: PRICES[pack.id],
          currencyCode: CURRENCY,
        }),
      );
    },
    async purchase(ref: PackageRef): Promise<PurchaseOutcome> {
      await wait(1100);
      if (mockStoreFlags.purchase === 'cancel') return { status: 'cancelled' };
      if (mockStoreFlags.purchase === 'fail') throw new BackendError('provider_failed');
      const transactionId = Crypto.randomUUID();
      const pack = CREDIT_PACKS.find((p) => p.id === ref.packageId);
      if (pack) {
        const productId = `${BUNDLE}.${pack.id}`;
        mockServer.grantPurchase(transactionId, productId);
        return { status: 'purchased', productId, transactionId, isTrial: false };
      }
      const offer = offers[ref.offeringId]?.();
      const chosen = offer?.plans.find((p) => p.packageId === ref.packageId);
      if (!chosen) throw new BackendError('not_found');
      mockServer.grantPurchase(transactionId, chosen.productId);
      const isTrial = chosen.trialDays !== null;
      entitlement = {
        isPro: true,
        productId: chosen.productId,
        willRenew: true,
        expiresAt: Date.now() + (chosen.trialDays ?? (chosen.period === 'week' ? 7 : 365)) * 86400000,
        isTrial,
      };
      emit();
      return { status: 'purchased', productId: chosen.productId, transactionId, isTrial };
    },
    async restore() {
      await wait(900);
      await mockServer.ready();
      if (mockServer.isPro && !entitlement.isPro) {
        entitlement = { ...entitlement, isPro: true, willRenew: true };
        emit();
      }
      return { ...entitlement };
    },
    async getEntitlement() {
      await mockServer.ready();
      if (mockServer.isPro && !entitlement.isPro) entitlement = { ...entitlement, isPro: true, willRenew: true };
      return { ...entitlement };
    },
    onEntitlementChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
