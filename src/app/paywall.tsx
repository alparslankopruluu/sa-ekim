/**
 * Custom animated paywall (docs/playbooks/paywall.md). Custom means we own the full
 * resilience contract: bounded offerings fetch, distinct failed/empty states with
 * retry, compliance block next to the CTA, restore + legal links, delayed close.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Switch, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OFFERINGS, type OfferingId } from '@shared/products';
import { PLAN_ALLOWANCE } from '@shared/pricing';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Confetti } from '@/components/Confetti';
import { PressableScale } from '@/components/PressableScale';
import { StageBackground } from '@/components/StageBackground';
import { StickerPhoto } from '@/components/StickerPhoto';
import { showToast } from '@/components/Toast';
import { CloseButton, ErrorState, Skeleton } from '@/components/ui';
import { SAMPLE_PHOTOS } from '@/features/demo/samples';
import { PlanCard } from '@/features/paywall/PlanCard';
import { useFeedback } from '@/hooks/useFeedback';
import { type PaywallSource, track } from '@/services/analytics';
import { BackendError } from '@/services/backend';
import { purchases } from '@/services/purchases';
import { annualSavingsPercent } from '@/services/purchases/format';
import type { PaywallOffer, PlanOption } from '@/services/purchases/types';
import { remoteFlag, remoteNumber, wheelPlacement } from '@/services/remoteConfig';
import { markGiftRedeemed } from '@/services/rewards';
import { useAccount } from '@/stores/account';
import { useSession } from '@/stores/session';
import { colors, layout, radius, spacing } from '@/theme/tokens';

type LoadState = { kind: 'loading' } | { kind: 'ready'; offer: PaywallOffer } | { kind: 'failed'; empty: boolean };

const FEATURES = [
  { icon: 'videocam', key: 'paywall.features.hd' },
  { icon: 'musical-notes', key: 'paywall.features.songs' },
  { icon: 'color-palette', key: 'paywall.features.looks' },
  { icon: 'ribbon', key: 'paywall.features.noWatermark' },
] as const;

const SOURCES: readonly PaywallSource[] = [
  'onboarding',
  'locked_resolution',
  'locked_look',
  'personal_song',
  'insufficient_credits',
  'settings',
  'home_banner',
  'gift',
  'result_upgrade',
  'notification',
];

function Hero() {
  const { width } = useWindowDimensions();
  // Compact so the plan cards stay above the pinned purchase footer on 6.1" phones.
  const size = Math.min(88, width * 0.22);
  return (
    <View style={[styles.hero, { height: size * 1.4 }]}>
      <Animated.View entering={ZoomIn.delay(80).springify()} style={[styles.heroSide, { left: width / 2 - size * 1.45 }]}>
        <StickerPhoto uri={SAMPLE_PHOTOS.rex} palette="lime" size={size * 0.86} tilt={-12} />
      </Animated.View>
      <Animated.View entering={ZoomIn.delay(160).springify()} style={[styles.heroSide, { right: width / 2 - size * 1.45 }]}>
        <StickerPhoto uri={SAMPLE_PHOTOS.mochi} palette="rose" size={size * 0.86} tilt={12} />
      </Animated.View>
      <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.heroCenter}>
        <StickerPhoto uri={SAMPLE_PHOTOS.nova} palette="magenta" size={size} tilt={0} />
      </Animated.View>
    </View>
  );
}

export default function PaywallScreen() {
  const { t } = useTranslation();
  const feedback = useFeedback();
  const params = useLocalSearchParams<{ source?: string; offering?: string }>();
  const source: PaywallSource = SOURCES.includes(params.source as PaywallSource) ? (params.source as PaywallSource) : 'settings';
  const offeringId: OfferingId =
    params.offering === OFFERINGS.giftDiscount || params.offering === OFFERINGS.giftTrial
      ? params.offering
      : OFFERINGS.default;
  const goal = useSession((s) => s.goal);
  const gift = useAccount((s) => s.gift);
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [selectedId, setSelectedId] = useState<'annual' | 'weekly'>('annual');
  const [buying, setBuying] = useState(false);
  const [canClose, setCanClose] = useState(false);
  const [celebrate, setCelebrate] = useState(0);
  const shownAt = useRef(0);

  const fetchOffer = useCallback(
    (force = false) => {
      purchases
        .loadOffer(offeringId, { force })
        .then((offer) => {
          setState({ kind: 'ready', offer });
          setSelectedId(offer.plans.some((p) => p.id === 'annual') ? 'annual' : (offer.plans[0]?.id ?? 'annual'));
          track('paywall_view', { source, offering: offer.offeringId });
        })
        .catch((error: unknown) => {
          const code = error instanceof BackendError ? error.code : 'unknown';
          const empty = code === 'not_found';
          setState({ kind: 'failed', empty });
          track('paywall_state', { state: empty ? 'empty' : 'failed', reason: code });
        });
    },
    [offeringId, source],
  );

  const reload = () => {
    setState({ kind: 'loading' });
    fetchOffer(true);
  };

  useEffect(() => {
    shownAt.current = Date.now();
    fetchOffer();
    const delay = source === 'onboarding' ? remoteNumber('paywall_close_delay_ms') : 0;
    const timer = setTimeout(() => setCanClose(true), delay);
    return () => clearTimeout(timer);
  }, [fetchOffer, source]);

  const offer = state.kind === 'ready' ? state.offer : null;
  const selected: PlanOption | undefined = offer?.plans.find((p) => p.id === selectedId) ?? offer?.plans[0];
  const annual = offer?.plans.find((p) => p.id === 'annual');
  const weekly = offer?.plans.find((p) => p.id === 'weekly');
  const savings = annual && weekly ? annualSavingsPercent(weekly.price, annual.introPrice ?? annual.price) : 0;
  const trialToggleVisible = remoteFlag('ff_trial_toggle') && !!annual?.trialDays && !!weekly;

  const close = useCallback(() => {
    track('paywall_dismiss', { source, viewed_s: Math.round((Date.now() - shownAt.current) / 1000) });
    const showWheel = source === 'onboarding' && wheelPlacement() === 'onboarding_exit' && !gift;
    if (showWheel) router.replace({ pathname: '/gift', params: { source: 'onboarding_exit' } });
    else if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }, [gift, source]);

  const buy = async () => {
    if (!selected || buying) return;
    setBuying(true);
    try {
      const outcome = await purchases.buyPlan(selected);
      if (outcome.status === 'purchased') {
        feedback.success();
        setCelebrate((c) => c + 1);
        if (offeringId !== OFFERINGS.default) void markGiftRedeemed();
        showToast(t('paywall.success'), 'success');
        setTimeout(() => (router.canGoBack() ? router.back() : router.replace('/(tabs)')), 1200);
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
    try {
      const restored = await purchases.restore();
      if (restored.isPro) {
        showToast(t('paywall.restoreSuccess'), 'success');
        setTimeout(close, 900);
      } else {
        showToast(t('paywall.restoreNone'), 'info');
      }
    } catch {
      showToast(t('paywall.failedBody'), 'error');
    }
  };

  const terms = useMemo(() => {
    if (!selected) return '';
    if (selected.introPriceString) {
      return t('paywall.terms.intro', { intro: selected.introPriceString, price: selected.priceString });
    }
    if (selected.trialDays) return t('paywall.terms.trial', { days: selected.trialDays, price: selected.priceString });
    return selected.period === 'year'
      ? t('paywall.terms.annual', { price: selected.priceString })
      : t('paywall.terms.weekly', { price: selected.priceString });
  }, [selected, t]);

  const allowance = selected ? PLAN_ALLOWANCE[selected.id].credits : 0;

  return (
    <View style={styles.root}>
      <StageBackground />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          {purchases.kind === 'mock' ? (
            <View style={styles.mockBadge}>
              <AppText variant="micro" color="cyan">
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
          <Hero />
          <Animated.View entering={FadeInUp.delay(120).duration(450)} style={styles.headline}>
            {offeringId !== OFFERINGS.default ? (
              <View style={styles.giftBanner}>
                <Ionicons name="gift" size={14} color={colors.textOnAccent} />
                <AppText variant="micro" color="textOnAccent">
                  {t('paywall.giftBanner')}
                </AppText>
              </View>
            ) : state.kind === 'ready' && state.offer.campaign ? (
              <View style={styles.giftBanner}>
                <Ionicons name="pricetag" size={14} color={colors.textOnAccent} />
                <AppText variant="micro" color="textOnAccent">
                  {t('paywall.campaignBanner')}
                </AppText>
              </View>
            ) : null}
            <AppText variant="title1" align="center" accessibilityRole="header">
              {t(`paywall.title.${goal ?? 'default'}`)}
            </AppText>
            <AppText variant="body" color="textSecondary" align="center">
              {t('paywall.subtitle')}
            </AppText>
          </Animated.View>

          {state.kind === 'loading' ? (
            <View style={styles.plans} accessibilityLabel={t('paywall.loading')}>
              <Skeleton style={styles.planSkeleton} />
              <Skeleton style={styles.planSkeleton} />
            </View>
          ) : state.kind === 'failed' ? (
            <ErrorState
              message={state.empty ? t('paywall.emptyBody') : `${t('paywall.failedTitle')}. ${t('paywall.failedBody')}`}
              onRetry={reload}
            />
          ) : (
            <Animated.View entering={FadeInDown.delay(120)} style={styles.plans}>
              {state.offer.plans.map((plan) => (
                <PlanCard
                  key={plan.productId}
                  plan={plan}
                  selected={selected?.id === plan.id}
                  savingsPercent={plan.id === 'annual' ? savings : 0}
                  onPress={() => {
                    setSelectedId(plan.id);
                    track('paywall_plan_select', { package: plan.id });
                  }}
                />
              ))}
              {trialToggleVisible && annual?.trialDays ? (
                <View style={styles.trialRow}>
                  <View style={styles.trialText}>
                    <AppText variant="bodyStrong">{t('paywall.trialToggle', { days: annual.trialDays })}</AppText>
                    <AppText variant="caption" color="textSecondary">
                      {t('paywall.trialToggleHint')}
                    </AppText>
                  </View>
                  <Switch
                    value={selectedId === 'annual'}
                    onValueChange={(on) => setSelectedId(on ? 'annual' : 'weekly')}
                    trackColor={{ true: colors.primary, false: colors.surfacePressed }}
                    accessibilityLabel={t('paywall.trialToggle', { days: annual.trialDays })}
                    testID="trial-toggle"
                    style={styles.switch}
                  />
                </View>
              ) : null}
            </Animated.View>
          )}

          <View style={styles.features}>
            {FEATURES.map((feature, index) => (
              <Animated.View key={feature.key} entering={FadeInDown.delay(220 + index * 80)} style={styles.feature}>
                <View style={styles.featureIcon}>
                  <Ionicons name={feature.icon} size={16} color={colors.text} />
                </View>
                <AppText variant="bodyStrong">{t(feature.key)}</AppText>
              </Animated.View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {selected ? (
            <AppText variant="caption" color="accent" align="center">
              {t(`paywall.planCredits.${selected.id}`, { count: allowance })}
            </AppText>
          ) : null}
          <Button
            label={
              buying
                ? t('paywall.cta.processing')
                : selected?.trialDays
                  ? t('paywall.cta.trial')
                  : t('paywall.cta.subscribe')
            }
            onPress={() => void buy()}
            loading={buying}
            disabled={!selected}
            shine
            testID="paywall-cta"
          />
          {selected ? (
            <AppText variant="caption" color="textTertiary" align="center" testID="paywall-terms">
              {terms}
            </AppText>
          ) : null}
          <View style={styles.links}>
            <PressableScale onPress={() => void restore()} style={styles.link} accessibilityLabel={t('paywall.restore')}>
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
        </View>
      </SafeAreaView>
      <Confetti fireKey={celebrate} />
    </View>
  );
}

const styles = StyleSheet.create({
  // RN's Switch defaults to alignSelf: 'flex-start'; keep it centered in its row.
  switch: { alignSelf: 'center' },
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
    borderColor: colors.cyan,
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
  heroSide: { position: 'absolute', top: 14 },
  heroCenter: { zIndex: 2 },
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
  features: { gap: spacing.md, paddingHorizontal: spacing.sm },
  feature: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  featureIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  plans: { gap: spacing.lg, paddingTop: spacing.sm },
  planSkeleton: { height: 72, borderRadius: radius.lg },
  trialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  trialText: { flex: 1, gap: 2 },
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
});
