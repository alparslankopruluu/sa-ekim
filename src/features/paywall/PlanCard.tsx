import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { PressableScale } from '@/components/PressableScale';
import { currentLocaleTag } from '@/lib/i18n';
import type { PlanOption } from '@/services/purchases/types';
import { springs } from '@/theme/motion';
import { colors, glows, radius, spacing } from '@/theme/tokens';

import { billedPriceString, perWeekString } from './plans';

export interface PlanCardProps {
  plan: PlanOption;
  selected: boolean;
  /** Floored % the yearly plan saves versus weekly (0 hides the line). Only used by the yearly card. */
  savingsPercent: number;
  onPress: () => void;
}

/**
 * The billed amount is always the most prominent number (App Review 3.1.2); the per-week
 * equivalent and the saving are captions. The selected card carries an animated glow ring
 * that pulses gently and holds still under Reduce Motion.
 */
export function PlanCard({ plan, selected, savingsPercent, onPress }: PlanCardProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const select = useSharedValue(selected ? 1 : 0);
  const pulse = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    select.set(selected ? withSpring(1, springs.settle) : withTiming(0, { duration: 160 }));
  }, [select, selected]);

  useEffect(() => {
    cancelAnimation(pulse);
    if (!selected) {
      pulse.set(withTiming(0, { duration: 160 }));
      return;
    }
    if (reduceMotion) {
      pulse.set(withTiming(1, { duration: 160 }));
      return;
    }
    pulse.set(
      withSequence(
        withTiming(1, { duration: 280 }),
        withRepeat(
          withSequence(
            withTiming(0.4, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
            withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
        ),
      ),
    );
    return () => cancelAnimation(pulse);
  }, [pulse, reduceMotion, selected]);

  const card = useAnimatedStyle(() => ({
    borderColor: interpolateColor(select.value, [0, 1], [colors.strokeStrong, colors.primary]),
    transform: [{ scale: reduceMotion ? 1 : 0.98 + select.value * 0.02 }],
  }));
  const glow = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const radio = useAnimatedStyle(() => ({ transform: [{ scale: select.value }] }));

  const isYear = plan.period === 'year';
  const name = t(`paywall.plans.${plan.id}`);
  const billedString = billedPriceString(plan);
  const billed = plan.introPriceString
    ? t('paywall.plans.firstYear', { price: billedString })
    : plan.period === 'year'
      ? t('paywall.plans.perYear', { price: billedString })
      : plan.period === 'month'
        ? t('paywall.plans.perMonth', { price: billedString })
        : t('paywall.plans.perWeek', { price: billedString });
  const weeklyAmount = perWeekString(plan, currentLocaleTag());
  const weekly = weeklyAmount ? t('paywall.plans.perWeek', { price: weeklyAmount }) : null;
  const savings = isYear && savingsPercent > 0 ? t('paywall.plans.save', { percent: savingsPercent }) : null;

  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      pressedScale={0.98}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={[isYear ? t('paywall.plans.bestValue') : null, name, billed, weekly, savings]
        .filter(Boolean)
        .join(', ')}
      testID={`plan-${plan.id}`}
    >
      <Animated.View pointerEvents="none" style={[styles.glowRing, glow]} />
      <Animated.View style={[styles.card, card]}>
        {isYear ? (
          <View style={styles.ribbon}>
            <AppText variant="micro" color="textOnAccent">
              {t('paywall.plans.bestValue')}
            </AppText>
          </View>
        ) : null}
        <View style={styles.radioOuter}>
          <Animated.View style={[styles.radioInner, radio]} />
        </View>
        <View style={styles.texts}>
          <AppText variant="headline">{name}</AppText>
          {savings ? (
            <AppText variant="caption" color="sage">
              {savings}
            </AppText>
          ) : null}
        </View>
        <View style={styles.prices}>
          <AppText variant="headline">{billed}</AppText>
          {weekly ? (
            <AppText variant="caption" color="textSecondary">
              {weekly}
            </AppText>
          ) : null}
        </View>
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    backgroundColor: colors.surface,
  },
  glowRing: {
    ...StyleSheet.absoluteFillObject,
    top: -4,
    bottom: -4,
    start: -4,
    end: -4,
    borderRadius: radius.lg + 4,
    borderWidth: 2,
    borderColor: colors.primary,
    boxShadow: glows.primary,
  },
  ribbon: {
    position: 'absolute',
    top: -11,
    end: spacing.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
  texts: { flex: 1, gap: 2 },
  prices: { alignItems: 'flex-end', gap: 2, flexShrink: 1 },
});
