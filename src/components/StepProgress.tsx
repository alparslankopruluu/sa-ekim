import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { colors, radius, spacing } from '@/theme/tokens';
import { springs } from '@/theme/motion';

export interface StepProgressProps {
  current: number;
  total: number;
  /** Endowed progress: the bar starts already partly filled (docs/playbooks/onboarding.md). */
  endowed?: number;
}

export function StepProgress({ current, total, endowed = 0.2 }: StepProgressProps) {
  const { t } = useTranslation();
  const target = endowed + (1 - endowed) * Math.min(1, Math.max(0, current / Math.max(1, total)));
  const fill = useSharedValue(endowed);

  useEffect(() => {
    fill.set(withSpring(target, springs.settle));
  }, [fill, target]);

  const style = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));

  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityLabel={t('a11y.step', { current: current + 1, total: total + 1 })}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(target * 100) }}
    >
      <Animated.View style={[styles.fill, style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceHigh,
    overflow: 'hidden',
    marginHorizontal: spacing.xs,
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
});
