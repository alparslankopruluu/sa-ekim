/**
 * Custom animated paywall (docs/playbooks/paywall.md). Custom means we own the full
 * resilience contract: bounded offerings fetch, distinct loading / failed / empty states
 * with retry, the subscription disclosure next to the CTA, Restore / Terms / Privacy, and a
 * close button that appears after a Remote Config delay on the onboarding source only.
 * No free trial exists anywhere: the billed price is the most prominent number.
 */
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FREE_LIMITS, PLAN_ALLOWANCE } from '@shared/pricing';
import { OFFERINGS, type PlanId } from '@shared/products';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Confetti } from '@/components/Confetti';
import { PressableScale } from '@/components/PressableScale';
import { StageBackground } from '@/components/StageBackground';
import { showToast } from '@/components/Toast';
import { CloseButton, ErrorState, Skeleton } from '@/components/ui';
import {
  type BenefitId,
  paywallContent,
  parseOfferingId,
  parsePaywallSource,
} from '@/features/paywall/content';
import { PlanCard } from '@/features/paywall/PlanCard';
import { defaultPlanId, disclosureKind, orderPlans, yearlySavingsPercent } from '@/features/paywall/plans';
import { useFeedback } from '@/hooks/useFeedback';
import { errorCodeOf } from '@/lib/errors';
import { startTrace, track } from '@/services/analytics';
import { purchases } from '@/services/purchases';
import type { PaywallOffer, PlanOption } from '@/services/purchases/types';
import { remoteNumber, wheelPlacement } from '@/services/remoteConfig';
import { markGiftRedeemed } from '@/services/rewards';
import { useAccount } from '@/stores/account';
import { useSession } from '@/stores/session';
import { colors, glows, gradients, layout, radius, spacing } from '@/theme/tokens';

type LoadState = { kind: 'loading' } | { kind: 'ready'; offer: PaywallOffer } | { kind: 'failed'; empty: boolean };

const BENEFIT_ICONS: Record<BenefitId, keyof typeof Ionicons.glyphMap> = {
  photos: 'images-outline',
  compare: 'git-compare-outline',
  band: 'analytics-outline',
  guide: 'book-outline',
  reminders: 'notifications-outline',
  report: 'document-text-outline',
  cohort: 'people-outline',
  hd: 'sparkles-outline',
  credits: 'flash-outline',
};

const MAX_CLOSE_DELAY_MS = 10000;
const SUCCESS_EXIT_MS = 1200;

function exitPaywall(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/(tabs)');
}

export default function PaywallScreen() {
  const { t } = useTranslation();
  const feedback = useFeedback();
  const params = useLocalSearchParams<{ source?: string; offering?: string }>();
  const source = parsePaywallSource(params.source);
  const offeringId = parseOfferingId(params.offering);
  const goal = useSession((s) => s.goal);
  const gift = useAccount((s) => s.gift);
  const content = useMemo(() => paywallContent(source, goal), [source, goal]);

  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [selectedId, setSelectedId] = useState<PlanId | null>(null);
  const [buying, setBuying] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [canClose, setCanClose] = useState(() => source !== 'onboarding');
  const [celebrate, setCelebrate] = useState(0);
  const shownAt = useRef(0);
  const viewed = useRef(false);
  const request = useRef(0);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchOffer = useCallback(
    (force: boolean) => {
      const id = ++request.current;
      const trace = startTrace('paywall_offerings_load');
      purchases
        .loadOffer(offeringId, { force })
        .then((offer) => {
          if (id !== request.current) return;
          trace.putAttribute('result', 'ok');
          trace.stop();
          setState({ kind: 'ready', offer });
          setSelectedId(defaultPlanId(offer.plans) as PlanId | null);
          if (!viewed.current) {
            viewed.current = true;
            track('paywall_view', { source, offering: offer.offeringId });
          }
        })
        .catch((error: unknown) => {
          if (id !== request.current) return;
          const code = errorCodeOf(error);
          const empty = code === 'not_found';
          trace.putAttribute('result', empty ? 'empty' : 'failed');
          trace.stop();
          setState({ kind: 'failed', empty });
          track('paywall_state', { state: empty ? 'empty' : 'failed', reason: code });
        });
    },
    [offeringId, source],
  );

  const reload = useCallback(() => {
    setState({ kind: 'loading' });
    fetchOffer(true);
  }, [fetchOffer]);

  useEffect(() => {
    shownAt.current = Date.now();
  }, []);

  useEffect(() => {
    fetchOffer(false);
    return () => {
      request.current += 1;
    };
  }, [fetchOffer]);

  useEffect(() => {
    // Soft-hard paywall: the close button is delayed on the onboarding source only.
    if (source !== 'onboarding') return;
    const delay = Math.min(Math.max(remoteNumber('paywall_close_delay_ms'), 0), MAX_CLOSE_DELAY_MS);
    const timer = setTimeout(() => setCanClose(true), delay);
    return () => clearTimeout(timer);
  }, [source]);

  useEffect(
    () => () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
    },
    [],
  );

  const offer = state.kind === 'ready' ? state.offer : null;
  const plans = useMemo(() => (offer ? orderPlans(offer.plans) : []), [offer]);
  const selected: PlanOption | undefined = plans.find((p) => p.id === selectedId) ?? plans[0];
  const savings = useMemo(() => yearlySavingsPercent(plans), [plans]);
  const isGiftOffer = offeringId === OFFERINGS.giftDiscount;

  const close = useCallback(() => {
    track('paywall_dismiss', { source, viewed_s: Math.round((Date.now() - shownAt.current) / 1000) });
    const showWheel = source === 'onboarding' && wheelPlacement() === 'onboarding_exit' && !gift;
    if (showWheel) router.replace({ pathname: '/gift', params: { source: 'onboarding_exit' } });
    else exitPaywall();
  }, [gift, source]);

  const buy = async () => {
    if (!selected || buying) return;
    setBuying(true);
    try {
      const outcome = await purchases.buyPlan(selected);
      if (outcome.status === 'purchased') {
        feedback.success();
        setCelebrate((c) => c + 1);
        if (isGiftOffer) void markGiftRedeemed();
        showToast(t('paywall.success'), 'success');
        exitTimer.current = setTimeout(exitPaywall, SUCCESS_EXIT_MS);
      } else if (outcome.status === 'pending') {
        showToast(t('paywall.pending'), 'info');
      }
    } catch {
      feedback.error();
      showToast(t('paywall.purchaseFailed'), 'error');
    } finally {
      setBuying(false);
    }
  };

  const restore = async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      const restored = await purchases.restore();
      if (restored.isPro) {
        feedback.success();
        showToast(t('paywall.restoreSuccess'), 'success');
        exitTimer.current = setTimeout(exitPaywall, 900);
      } else {
        showToast(t('paywall.restoreNone'), 'info');
      }
    } catch {
      showToast(t('paywall.failedBody'), 'error');
    } finally {
      setRestoring(false);
    }
  };

  const disclosure = useMemo(() => {
    if (!selected) return '';
    const kind = disclosureKind(selected);
    if (kind === 'intro') {
      return t('paywall.disclosure.intro', { intro: selected.introPriceString ?? '', price: selected.priceString });
    }
    return t(`paywall.disclosure.${kind}`, { price: selected.priceString });
  }, [selected, t]);

  const allowance = useMemo(() => {
    if (!selected) return '';
    if (selected.id === 'annual') {
      return t('paywall.planCredits.annual', {
        initial: PLAN_ALLOWANCE.annual.initial,
        count: PLAN_ALLOWANCE.annual.credits,
      });
    }
    return t(`paywall.planCredits.${selected.id}`, { count: PLAN_ALLOWANCE[selected.id].credits });
  }, [selected, t]);

  const headline =
    content.headline.kind === 'goal'
      ? t(`paywall.title.${content.headline.goal ?? 'default'}`)
      : t(`paywall.sources.${content.headline.source}.title`);
  const subtitle = t(`paywall.sources.${source}.subtitle`, { count: FREE_LIMITS.journeyPhotos });

  return (
    <View style={styles.root}>
      <StageBackground accents={[colors.primary, colors.accent]} animated={false} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          {purchases.kind === 'mock' ? (
            <View style={styles.mockBadge}>
              <AppText variant="micro" color="sage">
                {t('paywall.mockBadge')}
              </AppText>
            </View>
          ) : (
            <View />
          )}
          {canClose ? (
            <Animated.View entering={FadeIn.duration(300)}>
              <CloseButton onPress={close} testID="paywall-close" />
            </Animated.View>
          ) : (
            <View style={styles.closePlaceholder} />
          )}
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.heroBadge}>
              <LinearGradient
                colors={gradients.cta}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name={content.icon} size={32} color={colors.textOnAccent} />
            </Animated.View>
          </View>

          <Animated.View entering={FadeInUp.delay(100).duration(420)} style={styles.headline}>
            {isGiftOffer ? (
              <View style={styles.giftBanner} accessibilityRole="text">
                <Ionicons name="gift" size={14} color={colors.textOnAccent} />
                <AppText variant="micro" color="textOnAccent">
                  {t('paywall.giftBanner')}
                </AppText>
              </View>
            ) : null}
            <AppText variant="title1" align="center" accessibilityRole="header">
              {headline}
            </AppText>
            <AppText variant="body" color="textSecondary" align="center">
              {subtitle}
            </AppText>
          </Animated.View>

          {state.kind === 'loading' ? (
            <View style={styles.plans} accessibilityLabel={t('paywall.loading')} accessibilityRole="progressbar">
              <Skeleton style={styles.planSkeleton} />
              <Skeleton style={styles.planSkeleton} />
              <Skeleton style={styles.planSkeleton} />
            </View>
          ) : state.kind === 'failed' ? (
            <ErrorState
              message={state.empty ? t('paywall.emptyBody') : `${t('paywall.failedTitle')}. ${t('paywall.failedBody')}`}
              onRetry={reload}
            />
          ) : (
            <Animated.View entering={FadeInDown.delay(120)} style={styles.plans} accessibilityRole="radiogroup">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.productId}
                  plan={plan}
                  selected={selected?.id === plan.id}
                  savingsPercent={plan.period === 'year' ? savings : 0}
                  onPress={() => {
                    setSelectedId(plan.id);
                    track('paywall_plan_select', { package: plan.id });
                  }}
                />
              ))}
            </Animated.View>
          )}

          <View style={styles.benefits}>
            {content.benefits.map((benefit, index) => (
              <Animated.View key={benefit} entering={FadeInDown.delay(200 + index * 70)} style={styles.benefit}>
                <View style={styles.benefitIcon}>
                  <Ionicons name={BENEFIT_ICONS[benefit]} size={16} color={colors.sage} />
                </View>
                <AppText variant="callout" style={styles.benefitText}>
                  {t(`paywall.benefits.${benefit}`)}
                </AppText>
              </Animated.View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {selected ? (
            <AppText variant="caption" color="accent" align="center">
              {allowance}
            </AppText>
          ) : null}
          <Button
            label={buying ? t('paywall.cta.processing') : t('paywall.cta.subscribe')}
            onPress={() => void buy()}
            loading={buying}
            disabled={!selected}
            shine
            accessibilityHint={disclosure || undefined}
            testID="paywall-cta"
          />
          {selected ? (
            <AppText variant="caption" color="textTertiary" align="center" testID="paywall-disclosure">
              {disclosure}
            </AppText>
          ) : null}
          <View style={styles.links}>
            <PressableScale
              onPress={() => void restore()}
              disabled={restoring}
              style={styles.link}
              accessibilityLabel={t('paywall.restore')}
              testID="paywall-restore"
            >
              <AppText variant="caption" color="textSecondary">
                {t('paywall.restore')}
              </AppText>
            </PressableScale>
            <PressableScale
              onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'terms' } })}
              style={styles.link}
              accessibilityRole="link"
              accessibilityLabel={t('paywall.termsLink')}
            >
              <AppText variant="caption" color="textSecondary">
                {t('paywall.termsLink')}
              </AppText>
            </PressableScale>
            <PressableScale
              onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy' } })}
              style={styles.link}
              accessibilityRole="link"
              accessibilityLabel={t('paywall.privacy')}
            >
              <AppText variant="caption" color="textSecondary">
                {t('paywall.privacy')}
              </AppText>
            </PressableScale>
          </View>
          <PressableScale
            onPress={() => router.push({ pathname: '/credits', params: { source: 'paywall' } })}
            style={styles.creditsLink}
            accessibilityRole="link"
            accessibilityLabel={t('paywall.creditsLink')}
            testID="paywall-credits-link"
          >
            <AppText variant="caption" color="accent" align="center">
              {t('paywall.creditsLink')}
            </AppText>
          </PressableScale>
        </View>
      </SafeAreaView>
      <Confetti fireKey={celebrate} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: layout.screenPadding,
    minHeight: 52,
  },
  closePlaceholder: { width: 44, height: 44 },
  mockBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.sage,
  },
  scroll: {
    paddingHorizontal: layout.screenPadding,
    gap: spacing.xl,
    paddingBottom: spacing.xl,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  hero: { alignItems: 'center', justifyContent: 'center' },
  heroBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    boxShadow: glows.primary,
  },
  headline: { gap: spacing.sm, alignItems: 'center' },
  giftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  plans: { gap: spacing.lg, paddingTop: spacing.sm },
  planSkeleton: { height: 72, borderRadius: radius.lg },
  benefits: { gap: spacing.md, paddingHorizontal: spacing.xs },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  benefitIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHigh,
  },
  benefitText: { flex: 1 },
  footer: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  links: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xs },
  creditsLink: { minHeight: 36, justifyContent: 'center', alignItems: 'center' },
});
