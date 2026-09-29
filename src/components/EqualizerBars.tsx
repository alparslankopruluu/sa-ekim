import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { colors, type ColorToken } from '@/theme/tokens';

interface BarProps {
  index: number;
  height: number;
  width: number;
  color: string;
  active: boolean;
}

function Bar({ index, height, width, color, active }: BarProps) {
  const level = useSharedValue(0.3);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!active || reduceMotion) {
      cancelAnimation(level);
      level.set(withTiming(active ? 0.6 : 0.3, { duration: 200 }));
      return;
    }
    const peak = 0.55 + ((index * 37) % 45) / 100;
    const duration = 260 + ((index * 53) % 180);
    level.set(withDelay(
      index * 70,
      withRepeat(
        withSequence(
          withTiming(peak, { duration, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.2 + ((index * 17) % 20) / 100, { duration, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
        true,
      ),
    ));
    return () => cancelAnimation(level);
  }, [active, index, level, reduceMotion]);

  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: level.value }] }));

  return <Animated.View style={[{ width, height, borderRadius: width / 2, backgroundColor: color }, style]} />;
}

export interface EqualizerBarsProps {
  bars?: number;
  height?: number;
  barWidth?: number;
  color?: ColorToken;
  active?: boolean;
}

/** Decorative "audio is alive" indicator. Hidden from screen readers. */
export function EqualizerBars({ bars = 5, height = 20, barWidth = 3, color = 'text', active = true }: EqualizerBarsProps) {
  return (
    <View
      style={[styles.row, { height, gap: barWidth }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {Array.from({ length: bars }, (_, index) => (
        <Bar key={index} index={index} height={height} width={barWidth} color={colors[color]} active={active} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
