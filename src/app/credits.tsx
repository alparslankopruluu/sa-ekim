/**
 * Credit store: three consumable packs (10 / 25 / 60), the middle one badged Popular.
 * Same resilience contract as the paywall: bounded fetch, distinct failed / empty states with
 * retry. Prices always come from the store; the equivalents come from the shared credit table.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { previewCost } from '@shared/pricing';

import { AnimatedNumber } from '@/components/AnimatedNumber';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { PressableScale } from '@/components/PressableScale';
import { showToast } from '@/components/Toast';
import { Badge, CloseButton, ErrorState, Skeleton } from '@/components/ui';
import { previewEquivalents } from '@/features/paywall/credits';
import { useFeedback } from '@/hooks/useFeedback';
import { errorCodeOf } from '@/lib/errors';
import { track } from '@/services/analytics';
import { purchases } from '@/services/purchases';
import type { CreditPackOption } from '@/services/purchases/types';
import { useAccount } from '@/stores/account';
import { colors, glows, layout, radius, spacing } from '@/theme/tokens';

type State = { kind: 'loading' } | { kind: 'ready'; packs: CreditPackOption[] } | { kind: 'failed'; empty: boolean };

/** The pack in the middle of the ladder is the one we badge. */
const POPULAR_INDEX = 1;

export default function CreditsScreen() {
  const { t } = useTranslation();
  const feedback = useFeedback();
  const params = useLocalSearchParams<{ source?: string }>();
  const balance = useAccount((s) => s.wallet.balance);
  const freeHighTokens = useAccount((s) => s.wallet.freeHighTokens);
  const isPro = useAccount((s) => s.entitlement.isPro);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [buying, setBuying] = useState<string | null>(null);

  const fetchPacks = useCallback(() => {
    purchases
      .loadCreditPacks()
      .then((packs) =>
        setState(
          packs.length ? { kind: 'ready', packs: [...packs].sort((a, b) => a.credits - b.credits) } : { kind: 'failed', empty: true },
        ),
      )
      .catch(() => setState({ kind: 'failed', empty: false }));
  }, []);

  const reload = () => {
    setState({ kind: 'loading' });
    fetchPacks();
  };

  useEffect(() => {
    track('credits_store_view', { source: params.source ?? 'unknown' });
    fetchPacks();
  }, [fetchPacks, params.source]);

  const buy = async (pack: CreditPackOption) => {
    if (buying) return;
    setBuying(pack.id);
    try {
      const outcome = await purchases.buyCredits(pack);
      if (outcome.status === 'purchased') {
        feedback.success();
        showToast(t('credits.success', { count: pack.credits }), 'success');
      } else if (outcome.status === 'pending') {
        showToast(t('credits.pending'), 'info');
      }
    } catch (error) {
      feedback.error();
      showToast(errorCodeOf(error) === 'offline' ? t('errors.offline') : t('paywall.purchaseFailed'), 'error');
    } finally {
      setBuying(null);
    }
  };

  const balanceEquivalent = useMemo(() => previewEquivalents(balance), [balance]);
  const cost = { standard: previewCost('standard'), high: previewCost('high') };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <AppText variant="title2" accessibilityRole="header">
          {t('credits.title')}
        </AppText>
        <CloseButton onPress={() => router.back()} testID="credits-close" />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.balance} accessibilityLabel={t('ui.a11y.balance', { count: balance })} accessible>
          <AppText variant="micro" color="textTertiary">
            {t('credits.balance')}
          </AppText>
          <View style={styles.balanceRow}>
            <Ionicons name="flash" size={28} color={colors.accent} />
            <AnimatedNumber value={balance} variant="display" />
          </View>
          <AppText variant="callout" color="textSecondary" align="center">
            {t('credits.equivalent', balanceEquivalent)}
          </AppText>
          {freeHighTokens > 0 ? (
            <AppText variant="caption" color="accent" align="center">
              {t('credits.freeHigh', { count: freeHighTokens })}
            </AppText>
          ) : null}
        </View>
        <AppText variant="body" color="textSecondary" align="center">
          {t('credits.subtitle', cost)}
        </AppText>

        {state.kind === 'loading' ? (
          <View style={styles.packs} accessibilityRole="progressbar" accessibilityLabel={t('common.loading')}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} style={styles.packSkeleton} />
            ))}
          </View>
        ) : state.kind === 'failed' ? (
          <ErrorState message={state.empty ? t('credits.emptyBody') : t('credits.failedBody')} onRetry={reload} />
        ) : (
          <View style={styles.packs}>
            {state.packs.map((pack, index) => {
              const equivalent = previewEquivalents(pack.credits);
              const popular = index === POPULAR_INDEX;
              return (
                <Animated.View key={pack.id} entering={FadeInDown.delay(index * 80).springify()}>
                  <PressableScale
                    onPress={() => void buy(pack)}
                    disabled={buying !== null}
                    accessibilityLabel={[
                      t(`credits.packs.${pack.id}`),
                      t('common.credits', { count: pack.credits }),
                      pack.priceString,
                      t('credits.equivalent', equivalent),
                      popular ? t('credits.popular') : null,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                    style={[styles.pack, popular && styles.packPopular]}
                    testID={`pack-${pack.id}`}
                  >
                    {popular ? (
                      <View style={styles.popular}>
                        <Badge label={t('credits.popular')} />
                      </View>
                    ) : null}
                    <View style={styles.packText}>
                      <AppText variant="headline">{t(`credits.packs.${pack.id}`)}</AppText>
                      <AppText variant="callout" color="accent">
                        {t('common.credits', { count: pack.credits })}
                      </AppText>
                      <AppText variant="caption" color="textSecondary">
                        {t('credits.equivalent', equivalent)}
                      </AppText>
                    </View>
                    <Button
                      label={pack.priceString}
                      size="sm"
                      variant={popular ? 'primary' : 'secondary'}
                      loading={buying === pack.id}
                      disabled={buying !== null && buying !== pack.id}
                      onPress={() => void buy(pack)}
                    />
                  </PressableScale>
                </Animated.View>
              );
            })}
          </View>
        )}

        <View style={styles.examples}>
          <AppText variant="micro" color="textTertiary">
            {t('credits.examplesTitle')}
          </AppText>
          <View style={styles.example}>
            <Ionicons name="image-outline" size={18} color={colors.textSecondary} />
            <AppText variant="callout" style={styles.exampleLabel}>
              {t('credits.exampleStandard')}
            </AppText>
            <AppText variant="callout" color="accent">
              {t('common.creditsShort', { count: cost.standard })}
            </AppText>
          </View>
          <View style={styles.example}>
            <Ionicons name="sparkles-outline" size={18} color={colors.textSecondary} />
            <AppText variant="callout" style={styles.exampleLabel}>
              {t('credits.exampleHigh')}
            </AppText>
            <AppText variant="callout" color="accent">
              {t('common.creditsShort', { count: cost.high })}
            </AppText>
          </View>
        </View>

        {!isPro ? (
          <PressableScale
            onPress={() => router.replace({ pathname: '/paywall', params: { source: 'insufficient_credits' } })}
            style={styles.proHint}
            accessibilityLabel={t('credits.proHint')}
            testID="credits-pro-hint"
          >
            <Ionicons name="star" size={16} color={colors.accent} />
            <AppText variant="callout" color="textSecondary" style={styles.proHintText}>
              {t('credits.proHint')}
            </AppText>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </PressableScale>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgElevated },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.sm,
  },
  scroll: { paddingHorizontal: layout.screenPadding, gap: spacing.xl, paddingBottom: spacing.huge },
  balance: { alignItems: 'center', gap: spacing.xs, marginTop: spacing.md },
  balanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  packs: { gap: spacing.lg },
  packSkeleton: { height: 88, borderRadius: radius.lg },
  pack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.stroke,
  },
  packPopular: { borderColor: colors.primary, boxShadow: glows.primary },
  popular: { position: 'absolute', top: -11, start: spacing.lg },
  packText: { flex: 1, gap: 2 },
  examples: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface },
  example: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  exampleLabel: { flex: 1 },
  proHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.stroke,
  },
  proHintText: { flex: 1 },
});
