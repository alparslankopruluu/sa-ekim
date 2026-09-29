import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { colors, gradients } from '@/theme/tokens';
import { durations } from '@/theme/motion';

interface SpotProps {
  color: string;
  size: number;
  x: number;
  y: number;
  drift: number;
  duration: number;
  id: string;
  animate: boolean;
}

function Spotlight({ color, size, x, y, drift, duration, id, animate }: SpotProps) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (!animate) return;
    t.set(withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(t);
  }, [animate, duration, t]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: (t.value - 0.5) * drift },
      { translateY: (0.5 - t.value) * drift * 0.6 },
      { scale: 0.92 + t.value * 0.16 },
    ],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.spot, { width: size, height: size, left: x, top: y }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={0.55} />
            <Stop offset="55%" stopColor={color} stopOpacity={0.14} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={size} height={size} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

export interface StageBackgroundProps {
  /** Two accent colors for the spotlights (defaults to the brand copper/gold). */
  accents?: readonly [string, string];
  /** Ambient drift. Keep off on long-lived/list screens to save battery. */
  animated?: boolean;
  intensity?: 'full' | 'soft';
}

/**
 * Night-stage backdrop: deep gradient + two soft spotlights that drift slowly
 * (transform-only, UI thread). Frozen under Reduce Motion.
 */
export function StageBackground({ accents, animated = true, intensity = 'full' }: StageBackgroundProps) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [a, b] = accents ?? [colors.primary, colors.accent];
  const animate = animated && !reduceMotion;
  const big = Math.max(width, height) * (intensity === 'full' ? 0.95 : 0.7);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={gradients.stage} style={StyleSheet.absoluteFill} />
      <Spotlight
        id="spotA"
        color={a}
        size={big}
        x={-big * 0.45}
        y={-big * 0.35}
        drift={width * 0.25}
        duration={durations.ambient}
        animate={animate}
      />
      <Spotlight
        id="spotB"
        color={b}
        size={big * 0.85}
        x={width - big * 0.4}
        y={height * 0.35}
        drift={width * 0.2}
        duration={durations.ambient * 1.3}
        animate={animate}
      />
      <LinearGradient colors={gradients.fadeBottom} style={[StyleSheet.absoluteFill, styles.fade]} />
    </View>
  );
}

const styles = StyleSheet.create({
  spot: { position: 'absolute' },
  fade: { top: '55%' },
});
