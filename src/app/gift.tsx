/**
 * Welcome-gift wheel. One free spin per account; the server draws the prize and the wheel
 * only animates to it. Always dismissible, no purchase required, no countdown pressure
 * (App Review 5.6): the expiry is shown once as a plain date.
 */
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, StyleSheet, useWindowDimensions, View } from 'react-native';
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
import { errorCodeOf, useErrorMessage } from '@/lib/errors';
import { currentLocaleTag } from '@/lib/i18n';
import { track } from '@/services/analytics';
import { spinGiftWheel } from '@/services/rewards';
import { useAccount } from '@/stores/account';
import { colors, glows, layout, radius, spacing } from '@/theme/tokens';

const PRIZE_ICON: Record<PrizeId, keyof typeof Ionicons.glyphMap> = {
  credits10: 'flash',
  credits5: 'flash',
  freeHigh: 'sparkles',
  discount40: 'pricetag',
};

interface Won {
  prizeId: PrizeId;
  expiresAt: number;
  redeemedAt: number | null;
}

/** A plain calendar date (never a countdown). */
function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString(currentLocaleTag(), { month: 'long', day: 'numeric' });
}

export default function GiftScreen() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const feedback = useFeedback();
  const errorMessage = useErrorMessage();
  const params = useLocalSearchParams<{ source?: string }>();
  const source = params.source ?? 'home_card';
  const existing = useAccount((s) => s.gift);
  const wheelRef = useRef<GiftWheelHandle>(null);
  const [spinning, setSpinning] = useState(false);
  const [won, setWon] = useState<Won | null>(
    existing ? { prizeId: existing.prizeId, expiresAt: existing.expiresAt, redeemedAt: existing.redeemedAt } : null,
  );
  const [burst, setBurst] = useState(0);
  const wheelSize = Math.min(width - layout.screenPadding * 2, 340);

  useEffect(() => {
    track('gift_wheel_view', { source });
  }, [source]);

  const spin = async () => {
    if (spinning || won) return;
    setSpinning(true);
    feedback.impact();
    wheelRef.current?.windUp();
    let response: SpinGiftWheelResponse;
    try {
      response = await spinGiftWheel(source);
    } catch (error) {
      wheelRef.current?.abort();
      setSpinning(false);
      feedback.error();
      showToast(
        errorCodeOf(error) === 'already_claimed' ? t('gift.alreadyClaimed') : errorMessage(error),
        'error',
      );
      return;
    }
    await wheelRef.current?.landOn(response.segmentIndex);
    setSpinning(false);
    setWon({ prizeId: response.prizeId, expiresAt: Date.parse(response.expiresAt), redeemedAt: null });
    setBurst((b) => b + 1);
    feedback.success();
    AccessibilityInfo.announceForAccessibility(
      `${t('gift.youWon')}: ${t(`gift.prizes.${response.prizeId}.title`)}`,
    );
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  const prize = won ? PRIZES[won.prizeId] : null;
  const isOffer = prize?.kind === 'offering';
  const offerOpen = !!won && isOffer && won.redeemedAt === null && won.expiresAt > Date.now();

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
          {won && prize ? (
            <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.prizeCard} testID="gift-result">
              <View style={styles.prizeIcon}>
                <Ionicons name={PRIZE_ICON[won.prizeId]} size={26} color={colors.textOnAccent} />
              </View>
              <AppText variant="micro" color="accent">
                {t('gift.youWon')}
              </AppText>
              <AppText variant="title2" align="center">
                {t(`gift.prizes.${won.prizeId}.title`)}
              </AppText>
              <AppText variant="callout" color="textSecondary" align="center">
                {t(`gift.prizes.${won.prizeId}.body`)}
              </AppText>
              {isOffer ? (
                offerOpen ? (
                  <>
                    <AppText variant="caption" color="textTertiary">
                      {t('gift.expires', { date: formatDate(won.expiresAt) })}
                    </AppText>
                    <Button
                      label={t('gift.redeem')}
                      variant="gold"
                      shine
                      style={styles.prizeButton}
                      onPress={() =>
                        router.replace({
                          pathname: '/paywall',
                          params: { source: 'gift', offering: prize.offering ?? 'default' },
                        })
                      }
                      testID="gift-redeem"
                    />
                    <AppText variant="caption" color="textTertiary" align="center">
                      {t('gift.notifyNote')}
                    </AppText>
                  </>
                ) : (
                  <>
                    <AppText variant="caption" color="textTertiary" align="center">
                      {won.redeemedAt !== null ? t('gift.redeemed') : t('gift.expired', { date: formatDate(won.expiresAt) })}
                    </AppText>
                    <Button label={t('gift.done')} onPress={close} style={styles.prizeButton} testID="gift-done" />
                  </>
                )
              ) : (
                <>
                  <AppText variant="caption" color="success">
                    {t('gift.added')}
                  </AppText>
                  {prize.kind === 'token' ? (
                    <AppText variant="caption" color="textTertiary" align="center">
                      {t('gift.tokenNote')}
                    </AppText>
                  ) : null}
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
