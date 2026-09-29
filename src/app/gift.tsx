/**
 * Welcome-gift wheel. One free spin per account; the server draws the prize and
 * the wheel animates to it. Always dismissible, no purchase required, no
 * countdown pressure (App Review 5.6) — the expiry is shown once as a plain date.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { SpinGiftWheelResponse } from '@shared/api';
import { PRIZES, type PrizeId } from '@shared/wheel';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Confetti } from '@/components/Confetti';
import { StageBackground } from '@/components/StageBackground';
import { showToast } from '@/components/Toast';
import { CloseButton } from '@/components/ui';
import { GiftWheel, type GiftWheelHandle } from '@/features/gift/GiftWheel';
import { useFeedback } from '@/hooks/useFeedback';
import { currentLocaleTag } from '@/lib/i18n';
import { track } from '@/services/analytics';
import { BackendError } from '@/services/backend';
import { spinGiftWheel } from '@/services/rewards';
import { useAccount } from '@/stores/account';
import { colors, glows, layout, radius, spacing } from '@/theme/tokens';

const PRIZE_ICON: Record<PrizeId, keyof typeof Ionicons.glyphMap> = {
  credits40: 'flash',
  credits20: 'flash',
  freePoster: 'color-palette',
  hdBoost: 'sparkles',
  discount40: 'pricetag',
  trial7: 'calendar',
};

export default function GiftScreen() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const feedback = useFeedback();
  const params = useLocalSearchParams<{ source?: string }>();
  const source = params.source ?? 'home_card';
  const existing = useAccount((s) => s.gift);
  const wheelRef = useRef<GiftWheelHandle>(null);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ prizeId: PrizeId; expiresAt: number } | null>(
    existing ? { prizeId: existing.prizeId, expiresAt: existing.expiresAt } : null,
  );
  const [burst, setBurst] = useState(0);
  const wheelSize = Math.min(width - layout.screenPadding * 2, 340);

  useEffect(() => {
    track('gift_wheel_view', { source });
  }, [source]);

  const spin = async () => {
    if (spinning || result) return;
    setSpinning(true);
    feedback.impact();
    wheelRef.current?.windUp();
    let response: SpinGiftWheelResponse;
    try {
      response = await spinGiftWheel(source);
    } catch (error) {
      wheelRef.current?.abort();
      setSpinning(false);
      const code = error instanceof BackendError ? error.code : 'unknown';
      showToast(code === 'already_claimed' ? t('gift.alreadyClaimed') : t(`errors.${code}`), 'error');
      return;
    }
    await wheelRef.current?.landOn(response.segmentIndex);
    setSpinning(false);
    setResult({ prizeId: response.prizeId, expiresAt: Date.parse(response.expiresAt) });
    setBurst((b) => b + 1);
    feedback.success();
    feedback.sound('win');
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  const prize = result ? PRIZES[result.prizeId] : null;
  const date = result
    ? new Date(result.expiresAt).toLocaleDateString(currentLocaleTag(), { month: 'long', day: 'numeric' })
    : '';

  return (
    <View style={styles.root}>
      <StageBackground accents={[colors.accent, colors.primary]} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <View />
          <CloseButton onPress={close} testID="gift-close" />
        </View>

        <Animated.View entering={FadeInUp.duration(400)} style={styles.header}>
          <AppText variant="title1" align="center" accessibilityRole="header">
            {t('gift.title')}
          </AppText>
          <AppText variant="body" color="textSecondary" align="center">
            {t('gift.subtitle')}
          </AppText>
        </Animated.View>

        <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.wheel}>
          <GiftWheel ref={wheelRef} size={wheelSize} initialSegment={existing?.segmentIndex ?? null} />
        </Animated.View>

        <View style={styles.footer}>
          {result && prize ? (
            <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.prizeCard} testID="gift-result">
              <View style={styles.prizeIcon}>
                <Ionicons name={PRIZE_ICON[result.prizeId]} size={26} color={colors.textOnAccent} />
              </View>
              <AppText variant="micro" color="accent">
                {t('gift.youWon')}
              </AppText>
              <AppText variant="title2" align="center">
                {t(`prizes.${result.prizeId}.title`)}
              </AppText>
              <AppText variant="callout" color="textSecondary" align="center">
                {t(`prizes.${result.prizeId}.body`)}
              </AppText>
              {prize.kind === 'offering' ? (
                <>
                  <AppText variant="caption" color="textTertiary">
                    {t('gift.expires', { date })}
                  </AppText>
                  <Button
                    label={t('gift.redeem')}
                    variant="gold"
                    shine
                    style={styles.prizeButton}
                    onPress={() =>
                      router.replace({ pathname: '/paywall', params: { source: 'gift', offering: prize.offering ?? 'default' } })
                    }
                    testID="gift-redeem"
                  />
                  <AppText variant="caption" color="textTertiary" align="center">
                    {t('gift.notifyNote')}
                  </AppText>
                </>
              ) : (
                <>
                  <AppText variant="caption" color="success">
                    {t('gift.added')}
                  </AppText>
                  <Button label={t('gift.done')} onPress={close} style={styles.prizeButton} testID="gift-done" />
                </>
              )}
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn.delay(300)} style={styles.spinArea}>
              <Button
                label={spinning ? t('gift.spinning') : t('gift.spin')}
                onPress={() => void spin()}
                loading={spinning}
                variant="gold"
                shine
                testID="gift-spin"
              />
              <AppText variant="caption" color="textTertiary" align="center">
                {t('gift.fairness')}
              </AppText>
            </Animated.View>
          )}
        </View>
      </SafeAreaView>
      <Confetti fireKey={burst} count={90} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1, paddingHorizontal: layout.screenPadding },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', minHeight: 52, alignItems: 'center' },
  header: { gap: spacing.sm },
  wheel: { alignItems: 'center', marginTop: spacing.xxl },
  footer: { flex: 1, justifyContent: 'flex-end', paddingBottom: spacing.lg },
  spinArea: { gap: spacing.md },
  prizeCard: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    boxShadow: glows.gold,
  },
  prizeIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    marginTop: -40,
  },
  prizeButton: { alignSelf: 'stretch', marginTop: spacing.sm },
});
