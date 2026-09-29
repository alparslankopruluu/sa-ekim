import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { renderCost, STEP_COSTS } from '@shared/pricing';

import { AnimatedNumber } from '@/components/AnimatedNumber';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { PressableScale } from '@/components/PressableScale';
import { showToast } from '@/components/Toast';
import { Badge, CloseButton, ErrorState, Skeleton } from '@/components/ui';
import { useFeedback } from '@/hooks/useFeedback';
import { track } from '@/services/analytics';
import { purchases } from '@/services/purchases';
import type { CreditPackOption } from '@/services/purchases/types';
import { useAccount } from '@/stores/account';
import { colors, glows, layout, radius, spacing } from '@/theme/tokens';

type State = { kind: 'loading' } | { kind: 'ready'; packs: CreditPackOption[] } | { kind: 'failed' };

export default function CreditsScreen() {
  const { t } = useTranslation();
  const feedback = useFeedback();
  const params = useLocalSearchParams<{ source?: string }>();
  const balance = useAccount((s) => s.wallet.balance);
  const isPro = useAccount((s) => s.entitlement.isPro);
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [buying, setBuying] = useState<string | null>(null);

  const fetchPacks = useCallback(() => {
    purchases
      .loadCreditPacks()
      .then((packs) => setState(packs.length ? { kind: 'ready', packs } : { kind: 'failed' }))
      .catch(() => setState({ kind: 'failed' }));
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
    setBuying(pack.id);
    try {
      const outcome = await purchases.buyCredits(pack);
      if (outcome.status === 'purchased') {
        feedback.success();
        showToast(t('credits.success', { count: pack.credits }), 'success');
      }
    } catch {
      showToast(t('paywall.purchaseFailed'), 'error');
    } finally {
      setBuying(null);
    }
  };

  const examples = [
    { icon: 'videocam-outline', label: t('credits.exampleVideo'), cost: renderCost('768p', 10) },
    { icon: 'color-palette-outline', label: t('credits.examplePoster'), cost: STEP_COSTS.poster },
    { icon: 'musical-notes-outline', label: t('credits.exampleSong'), cost: STEP_COSTS.personalSong },
  ] as const;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <AppText variant="title2" accessibilityRole="header">
          {t('credits.title')}
        </AppText>
        <CloseButton onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.balance}>
          <Ionicons name="flash" size={28} color={colors.accent} />
          <AnimatedNumber value={balance} variant="display" />
        </View>
        <AppText variant="body" color="textSecondary" align="center">
          {t('credits.subtitle')}
        </AppText>

        {state.kind === 'loading' ? (
          <View style={styles.packs}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} style={styles.packSkeleton} />
            ))}
          </View>
        ) : state.kind === 'failed' ? (
          <ErrorState message={t('paywall.failedBody')} onRetry={reload} />
        ) : (
          <View style={styles.packs}>
            {state.packs.map((pack, index) => (
              <Animated.View key={pack.id} entering={FadeInDown.delay(index * 80).springify()}>
                <PressableScale
                  onPress={() => void buy(pack)}
                  disabled={buying !== null}
                  accessibilityLabel={`${t(`credits.packs.${pack.id}`)}, ${t('common.credits', { count: pack.credits })}, ${pack.priceString}`}
                  style={[styles.pack, index === 1 && styles.packPopular]}
                  testID={`pack-${pack.id}`}
                >
                  {index === 1 ? (
                    <View style={styles.popular}>
                      <Badge label={t('credits.popular')} />
                    </View>
                  ) : null}
                  <View style={styles.packText}>
                    <AppText variant="headline">{t(`credits.packs.${pack.id}`)}</AppText>
                    <AppText variant="callout" color="accent">
                      {t('common.credits', { count: pack.credits })}
                    </AppText>
                  </View>
                  <Button
                    label={pack.priceString}
                    size="sm"
                    variant={index === 1 ? 'primary' : 'secondary'}
                    loading={buying === pack.id}
                    onPress={() => void buy(pack)}
                  />
                </PressableScale>
              </Animated.View>
            ))}
          </View>
        )}

        <View style={styles.examples}>
          <AppText variant="micro" color="textTertiary">
            {t('credits.examplesTitle')}
          </AppText>
          {examples.map((example) => (
            <View key={example.label} style={styles.example}>
              <Ionicons name={example.icon} size={18} color={colors.textSecondary} />
              <AppText variant="callout" style={styles.exampleLabel}>
                {example.label}
              </AppText>
              <AppText variant="callout" color="accent">
                {t('common.creditsShort', { count: example.cost })}
              </AppText>
            </View>
          ))}
        </View>

        {!isPro ? (
          <PressableScale
            onPress={() => router.replace({ pathname: '/paywall', params: { source: 'insufficient_credits' } })}
            style={styles.proHint}
            accessibilityLabel={t('credits.proHint')}
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
  balance: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.md },
  packs: { gap: spacing.lg },
  packSkeleton: { height: 76, borderRadius: radius.lg },
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
  popular: { position: 'absolute', top: -11, left: spacing.lg },
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
