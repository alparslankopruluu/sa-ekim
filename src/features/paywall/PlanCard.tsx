import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { PressableScale } from '@/components/PressableScale';
import { currentLocaleTag } from '@/lib/i18n';
import { formatCurrency, perWeek } from '@/services/purchases/format';
import type { PlanOption } from '@/services/purchases/types';
import { colors, glows, radius, spacing } from '@/theme/tokens';
import { springs } from '@/theme/motion';

export interface PlanCardProps {
  plan: PlanOption;
  selected: boolean;
  savingsPercent: number;
  onPress: () => void;
}

/**
 * The billed amount is always the most prominent number (App Review 3.1.2);
 * the per-week equivalent is secondary.
 */
export function PlanCard({ plan, selected, savingsPercent, onPress }: PlanCardProps) {
  const { t } = useTranslation();
  const glow = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    glow.set(selected ? withSpring(1, springs.settle) : withTiming(0, { duration: 160 }));
  }, [glow, selected]);

  const ring = useAnimatedStyle(() => ({
    borderColor: glow.value > 0.5 ? colors.primary : colors.strokeStrong,
    transform: [{ scale: 0.98 + glow.value * 0.02 }],
  }));
  const radio = useAnimatedStyle(() => ({ transform: [{ scale: glow.value }] }));

  const billed =
    plan.period === 'year'
      ? t('paywall.plans.perYear', { price: plan.introPriceString ?? plan.priceString })
      : t('paywall.plans.perWeek', { price: plan.priceString });
  const weekly =
    plan.period === 'year'
      ? t('paywall.plans.perWeek', {
          price: formatCurrency(perWeek(plan.introPrice ?? plan.price), plan.currencyCode, currentLocaleTag()),
        })
      : null;
  const name = plan.period === 'year' ? t('paywall.plans.annual') : t('paywall.plans.weekly');

  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      pressedScale={0.98}
      accessibilityRole="radio"
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={[name, billed, weekly].filter(Boolean).join(', ')}
      testID={`plan-${plan.id}`}
    >
      <Animated.View style={[styles.card, ring, selected && { boxShadow: glows.primary }]}>
        {plan.period === 'year' ? (
          <View style={styles.ribbon}>
            <AppText variant="micro" color="textOnAccent">
              {savingsPercent > 0 ? t('paywall.plans.save', { percent: savingsPercent }) : t('paywall.plans.bestValue')}
            </AppText>
          </View>
        ) : null}
        <View style={styles.radioOuter}>
          <Animated.View style={[styles.radioInner, radio]} />
        </View>
        <View style={styles.texts}>
          <AppText variant="headline">{name}</AppText>
          {plan.trialDays ? (
            <AppText variant="caption" color="accent">
              {t('paywall.trialToggle', { days: plan.trialDays })}
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
  ribbon: {
    position: 'absolute',
    top: -11,
    right: spacing.lg,
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
  prices: { alignItems: 'flex-end', gap: 2 },
});
