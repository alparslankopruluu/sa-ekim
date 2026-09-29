/**
 * RevenueCat adapter (iOS App Store + Google Play). The ONLY file that imports
 * react-native-purchases (AGENTS.md §4: purchase logic stays in the wrapper).
 * Public SDK keys come from EXPO_PUBLIC_REVENUECAT_{IOS,ANDROID}_KEY.
 */
import { Platform } from 'react-native';
import Purchases, {
  type CustomerInfo,
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases';

import { CREDIT_PACKS, type CreditPackId } from '@shared/pricing';
import { ENTITLEMENT_PRO, OFFERINGS, type OfferingId, PACKAGES } from '@shared/products';

import { BackendError } from '../backend/types';
import { isoPeriodToDays, periodToDays } from './format';
import {
  type CreditPackOption,
  type EntitlementState,
  NO_ENTITLEMENT,
  type PaywallOffer,
  type PlanOption,
  type PurchaseOutcome,
  type PurchasesAdapter,
} from './types';

const API_KEY =
  Platform.OS === 'ios' ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

export function hasRevenueCatKey(): boolean {
  return typeof API_KEY === 'string' && API_KEY.length > 0;
}

function toEntitlement(info: CustomerInfo): EntitlementState {
  const pro = info.entitlements.active[ENTITLEMENT_PRO];
  if (!pro) return { ...NO_ENTITLEMENT };
  return {
    isPro: pro.isActive,
    productId: pro.productIdentifier,
    willRenew: pro.willRenew,
    expiresAt: pro.expirationDate ? Date.parse(pro.expirationDate) : null,
    isTrial: pro.periodType === 'TRIAL',
  };
}

function mapError(error: unknown): BackendError {
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
  switch (code) {
    case PURCHASES_ERROR_CODE.NETWORK_ERROR:
    case PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR:
      return new BackendError('offline');
    case PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR:
      return new BackendError('not_found');
    default:
      return new BackendError('provider_failed');
  }
}

function planFrom(offeringId: OfferingId, pkg: PurchasesPackage): PlanOption | null {
  const isWeekly = pkg.identifier === PACKAGES.weekly || pkg.product.subscriptionPeriod === 'P1W';
  const isAnnual = pkg.identifier === PACKAGES.annual || pkg.product.subscriptionPeriod === 'P1Y';
  if (!isWeekly && !isAnnual) return null;
  const intro = pkg.product.introPrice;
  const isFreeTrial = intro !== null && intro.price === 0;
  const trialDays = isFreeTrial ? periodToDays(intro.periodUnit, intro.periodNumberOfUnits) : null;
  return {
    id: isWeekly ? 'weekly' : 'annual',
    offeringId,
    packageId: pkg.identifier,
    productId: pkg.product.identifier,
    priceString: pkg.product.priceString,
    price: pkg.product.price,
    currencyCode: pkg.product.currencyCode,
    period: isWeekly ? 'week' : 'year',
    trialDays: trialDays ?? (isFreeTrial ? isoPeriodToDays(intro.period) : null),
    introPriceString: intro && !isFreeTrial ? intro.priceString : null,
    introPrice: intro && !isFreeTrial ? intro.price : null,
  };
}

export function createRevenueCatAdapter(): PurchasesAdapter | null {
  if (!hasRevenueCatKey()) return null;
  const offeringCache = new Map<string, PurchasesOffering>();

  const findPackage = (offeringId: string, packageId: string): PurchasesPackage | undefined =>
    offeringCache.get(offeringId)?.availablePackages.find((p) => p.identifier === packageId);

  const refreshOfferings = async () => {
    const offerings = await Purchases.getOfferings();
    Object.entries(offerings.all).forEach(([id, offering]) => offeringCache.set(id, offering));
    return offerings;
  };

  return {
    kind: 'revenuecat',
    configure() {
      if (__DEV__) void Purchases.setLogLevel(LOG_LEVEL.WARN);
      Purchases.configure({ apiKey: API_KEY ?? '' });
    },
    async logIn(uid) {
      try {
        await Purchases.logIn(uid);
      } catch (error) {
        throw mapError(error);
      }
    },
    async getOffer(offeringId) {
      try {
        const offerings = await refreshOfferings();
        // The main paywall follows RevenueCat's *current* offering, so a seasonal
        // offering (e.g. Black Friday) can be switched on from the dashboard or a
        // targeting rule without an app update. Cached under `default` for purchase().
        const offering =
          offeringId === OFFERINGS.default
            ? (offerings.current ?? offerings.all[OFFERINGS.default] ?? null)
            : (offerings.all[offeringId] ?? null);
        if (!offering) return null;
        if (offeringId === OFFERINGS.default) offeringCache.set(OFFERINGS.default, offering);
        const plans = offering.availablePackages
          .map((pkg) => planFrom(offeringId, pkg))
          .filter((p): p is PlanOption => p !== null)
          .sort((a, b) => (a.id === 'annual' ? -1 : 1) - (b.id === 'annual' ? -1 : 1));
        const campaign = offeringId === OFFERINGS.default && offering.identifier !== OFFERINGS.default;
        return plans.length ? ({ offeringId, plans, campaign } satisfies PaywallOffer) : null;
      } catch (error) {
        throw mapError(error);
      }
    },
    async getCreditPacks() {
      try {
        const offerings = await refreshOfferings();
        const offering = offerings.all[OFFERINGS.credits];
        if (!offering) return [];
        return offering.availablePackages
          .map((pkg): CreditPackOption | null => {
            const pack = CREDIT_PACKS.find((p) => pkg.product.identifier.includes(p.id) || pkg.identifier === p.id);
            if (!pack) return null;
            return {
              id: pack.id as CreditPackId,
              credits: pack.credits,
              packageId: pkg.identifier,
              productId: pkg.product.identifier,
              priceString: pkg.product.priceString,
              price: pkg.product.price,
              currencyCode: pkg.product.currencyCode,
            };
          })
          .filter((p): p is CreditPackOption => p !== null)
          .sort((a, b) => a.credits - b.credits);
      } catch (error) {
        throw mapError(error);
      }
    },
    async purchase(ref): Promise<PurchaseOutcome> {
      const pkg = findPackage(ref.offeringId, ref.packageId);
      if (!pkg) throw new BackendError('not_found');
      try {
        const result = await Purchases.purchasePackage(pkg);
        const entitlement = toEntitlement(result.customerInfo);
        return {
          status: 'purchased',
          productId: result.productIdentifier,
          transactionId: result.transaction.transactionIdentifier,
          isTrial: entitlement.isTrial,
        };
      } catch (error) {
        const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
        if (code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return { status: 'cancelled' };
        if (code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) return { status: 'pending' };
        throw mapError(error);
      }
    },
    async restore() {
      try {
        return toEntitlement(await Purchases.restorePurchases());
      } catch (error) {
        throw mapError(error);
      }
    },
    async getEntitlement() {
      try {
        return toEntitlement(await Purchases.getCustomerInfo());
      } catch {
        return { ...NO_ENTITLEMENT };
      }
    },
    onEntitlementChange(listener) {
      const handler = (info: CustomerInfo) => listener(toEntitlement(info));
      Purchases.addCustomerInfoUpdateListener(handler);
      return () => {
        Purchases.removeCustomerInfoUpdateListener(handler);
      };
    },
    async setAnalyticsInstanceId(id) {
      await Purchases.setFirebaseAppInstanceID(id);
    },
  };
}
