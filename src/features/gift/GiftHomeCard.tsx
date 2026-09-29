import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { PRIZES } from '@shared/wheel';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { PressableScale } from '@/components/PressableScale';
import { currentLocaleTag } from '@/lib/i18n';
import { track } from '@/services/analytics';
import { wheelPlacement } from '@/services/remoteConfig';
import { useAccount } from '@/stores/account';
import { colors, glows, radius, spacing } from '@/theme/tokens';

function GiftBox() {
  const reduceMotion = useReducedMotion();
  const wiggle = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    wiggle.set(withRepeat(
      withSequence(
        withDelay(1800, withTiming(1, { duration: 90 })),
        withTiming(-1, { duration: 120 }),
        withTiming(0.6, { duration: 100 }),
        withTiming(0, { duration: 100 }),
      ),
      -1,
    ));
    return () => cancelAnimation(wiggle);
  }, [reduceMotion, wiggle]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${wiggle.value * 10}deg` }] }));
  return (
    <Animated.View style={[styles.box, style]}>
      <AppText style={styles.boxEmoji} accessibilityElementsHidden importantForAccessibility="no">
        {'🎁'}
      </AppText>
    </Animated.View>
  );
}

/** Home entry to the welcome-gift wheel (user-initiated: lowest App Review 5.6 risk). */
export function GiftHomeCard() {
  const { t } = useTranslation();
  const gift = useAccount((s) => s.gift);
  const backendReady = useAccount((s) => s.backendState === 'ready');
  const placement = wheelPlacement();
  const [now] = useState(() => Date.now());

  if (!backendReady || placement === 'off') return null;

  if (!gift) {
    return (
      <Animated.View entering={FadeInDown.springify()}>
        <PressableScale
          onPress={() => {
            track('gift_wheel_view', { source: 'home_card' });
            router.push({ pathname: '/gift', params: { source: 'home_card' } });
          }}
          style={styles.card}
          accessibilityLabel={`${t('gift.card.title')}. ${t('gift.card.body')}`}
          testID="gift-home-card"
        >
          <GiftBox />
          <View style={styles.text}>
            <AppText variant="headline">{t('gift.card.title')}</AppText>
            <AppText variant="caption" color="textSecondary">
              {t('gift.card.body')}
            </AppText>
          </View>
          <View style={styles.cta}>
            <AppText variant="callout" color="textOnAccent">
              {t('gift.card.cta')}
            </AppText>
          </View>
        </PressableScale>
      </Animated.View>
    );
  }

  const prize = PRIZES[gift.prizeId];
  const active = prize.kind === 'offering' && gift.redeemedAt === null && gift.expiresAt > now;
  if (!active) return null;

  const date = new Date(gift.expiresAt).toLocaleDateString(currentLocaleTag(), { month: 'short', day: 'numeric' });
  return (
    <Animated.View entering={FadeInDown.springify()} style={styles.card}>
      <GiftBox />
      <View style={styles.text}>
        <AppText variant="headline">{t('gift.card.wonTitle', { prize: t(`gift.prizes.${gift.prizeId}.title`) })}</AppText>
        <AppText variant="caption" color="textSecondary">
          {t('gift.card.wonBody', { date })}
        </AppText>
      </View>
      <Button
        label={t('gift.card.use')}
        size="sm"
        variant="gold"
        onPress={() =>
          router.push({ pathname: '/paywall', params: { source: 'gift', offering: prize.offering ?? 'default' } })
        }
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
    boxShadow: glows.gold,
  },
  box: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHigh,
  },
  boxEmoji: { fontSize: 28, lineHeight: 34 },
  text: { flex: 1, gap: 2 },
  cta: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
});
