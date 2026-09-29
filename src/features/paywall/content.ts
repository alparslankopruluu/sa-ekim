/**
 * Source-keyed paywall content. Pure data: which headline, which benefits and which icon a
 * paywall shows for the surface that opened it. Copy lives in the `paywall` namespace; this
 * module only picks keys, so it is unit-testable and the screen stays declarative.
 */
import type { Ionicons } from '@expo/vector-icons';

import type { Goal } from '@shared/catalog';
import { OFFERINGS, type OfferingId } from '@shared/products';

import type { PaywallSource } from '@/services/analytics';

export const PAYWALL_SOURCES = [
  'onboarding',
  'locked_compare',
  'locked_band',
  'locked_photos',
  'locked_report',
  'locked_hd',
  'locked_guide',
  'insufficient_credits',
  'settings',
  'home_banner',
  'gift',
  'result_upgrade',
  'notification',
] as const satisfies readonly PaywallSource[];

export type BenefitId = 'photos' | 'compare' | 'band' | 'guide' | 'reminders' | 'report' | 'cohort' | 'hd' | 'credits';

/** Sources whose headline is specific to what the user tried to open. */
export type TitledSource =
  | 'locked_compare'
  | 'locked_band'
  | 'locked_photos'
  | 'locked_report'
  | 'locked_hd'
  | 'locked_guide'
  | 'insufficient_credits'
  | 'result_upgrade';

const TITLED: readonly PaywallSource[] = [
  'locked_compare',
  'locked_band',
  'locked_photos',
  'locked_report',
  'locked_hd',
  'locked_guide',
  'insufficient_credits',
  'result_upgrade',
];

export type Headline = { kind: 'goal'; goal: Goal | null } | { kind: 'source'; source: TitledSource };

export interface PaywallContent {
  source: PaywallSource;
  headline: Headline;
  benefits: readonly BenefitId[];
  icon: keyof typeof Ionicons.glyphMap;
}

const BENEFITS: Record<PaywallSource, readonly BenefitId[]> = {
  onboarding: ['band', 'compare', 'guide', 'hd'],
  locked_compare: ['compare', 'band', 'photos', 'guide'],
  locked_band: ['band', 'compare', 'guide', 'reminders'],
  locked_photos: ['photos', 'compare', 'band', 'guide'],
  locked_report: ['report', 'photos', 'compare', 'band'],
  locked_hd: ['hd', 'credits', 'compare', 'band'],
  locked_guide: ['guide', 'reminders', 'band', 'compare'],
  insufficient_credits: ['credits', 'hd', 'compare', 'band'],
  settings: ['band', 'compare', 'guide', 'reminders'],
  home_banner: ['band', 'compare', 'guide', 'reminders'],
  gift: ['band', 'compare', 'guide', 'hd'],
  result_upgrade: ['hd', 'credits', 'compare', 'band'],
  notification: ['band', 'compare', 'guide', 'reminders'],
};

const ICONS: Record<PaywallSource, keyof typeof Ionicons.glyphMap> = {
  onboarding: 'leaf-outline',
  locked_compare: 'git-compare-outline',
  locked_band: 'analytics-outline',
  locked_photos: 'camera-outline',
  locked_report: 'document-text-outline',
  locked_hd: 'sparkles-outline',
  locked_guide: 'book-outline',
  insufficient_credits: 'flash-outline',
  settings: 'leaf-outline',
  home_banner: 'leaf-outline',
  gift: 'gift-outline',
  result_upgrade: 'sparkles-outline',
  notification: 'leaf-outline',
};

export function isPaywallSource(value: unknown): value is PaywallSource {
  return typeof value === 'string' && (PAYWALL_SOURCES as readonly string[]).includes(value);
}

/** Route param → source; an unknown or missing value is treated as the Settings entry. */
export function parsePaywallSource(value: unknown): PaywallSource {
  return isPaywallSource(value) ? value : 'settings';
}

/** Route param → offering; only the subscription offerings can be shown on the paywall. */
export function parseOfferingId(value: unknown): OfferingId {
  return value === OFFERINGS.giftDiscount ? OFFERINGS.giftDiscount : OFFERINGS.default;
}

export function paywallContent(source: PaywallSource, goal: Goal | null): PaywallContent {
  const headline: Headline = TITLED.includes(source)
    ? { kind: 'source', source: source as TitledSource }
    : { kind: 'goal', goal };
  return { source, headline, benefits: BENEFITS[source], icon: ICONS[source] };
}
