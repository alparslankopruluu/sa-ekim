import type { CreditPackId } from '@shared/pricing';
import type { OfferingId, PlanId } from '@shared/products';

export type { PlanId } from '@shared/products';

/** There is no free trial anywhere in Kök (owner decision, 2026-09-29): no trial fields exist. */
export interface PlanOption {
  id: PlanId;
  offeringId: OfferingId;
  packageId: string;
  productId: string;
  /** Localized store price string — always display this, never a hardcoded price. */
  priceString: string;
  price: number;
  currencyCode: string;
  period: 'week' | 'month' | 'year';
  /** Discounted first-period price (the `gift_discount` annual), null otherwise. */
  introPriceString: string | null;
  introPrice: number | null;
}

export interface CreditPackOption {
  id: CreditPackId;
  credits: number;
  packageId: string;
  productId: string;
  priceString: string;
  price: number;
  currencyCode: string;
}

export interface PaywallOffer {
  offeringId: OfferingId;
  /** Ordered best value first: annual, monthly, weekly. */
  plans: PlanOption[];
  /** Main paywall is serving a seasonal RevenueCat offering (current ≠ `default`). */
  campaign?: boolean;
}

export interface EntitlementState {
  isPro: boolean;
  productId: string | null;
  willRenew: boolean;
  /** Epoch ms, null for non-expiring or unknown. */
  expiresAt: number | null;
  /** Always false: kept so stored/legacy shapes stay valid. */
  isTrial: boolean;
}

export const NO_ENTITLEMENT: EntitlementState = {
  isPro: false,
  productId: null,
  willRenew: false,
  expiresAt: null,
  isTrial: false,
};

export type PurchaseOutcome =
  | { status: 'purchased'; productId: string; transactionId: string }
  | { status: 'cancelled' }
  | { status: 'pending' };

export interface PackageRef {
  offeringId: OfferingId;
  packageId: string;
}

export interface PurchasesAdapter {
  kind: 'mock' | 'revenuecat';
  configure(): void;
  logIn(uid: string): Promise<void>;
  getOffer(offeringId: OfferingId): Promise<PaywallOffer | null>;
  getCreditPacks(): Promise<CreditPackOption[]>;
  purchase(ref: PackageRef): Promise<PurchaseOutcome>;
  restore(): Promise<EntitlementState>;
  getEntitlement(): Promise<EntitlementState>;
  onEntitlementChange(listener: (state: EntitlementState) => void): () => void;
  setAnalyticsInstanceId?(id: string): Promise<void>;
}
