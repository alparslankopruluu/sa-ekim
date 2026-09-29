import type { CreditPackId } from '@shared/pricing';
import type { OfferingId } from '@shared/products';

export type PlanId = 'weekly' | 'annual';

export interface PlanOption {
  id: PlanId;
  offeringId: OfferingId;
  packageId: string;
  productId: string;
  /** Localized store price string — always display this, never a hardcoded price. */
  priceString: string;
  price: number;
  currencyCode: string;
  period: 'week' | 'year';
  /** Free-trial length in days (null when the plan has no free trial). */
  trialDays: number | null;
  /** Discounted first-period price (e.g. gift offer), null otherwise. */
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
  | { status: 'purchased'; productId: string; transactionId: string; isTrial: boolean }
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
