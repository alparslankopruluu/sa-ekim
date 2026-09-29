import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/theme/tokens';

const PALETTE = [colors.primary, colors.accent, colors.cyan, colors.orange, colors.violet, colors.success];

interface Particle {
  x: number;
  drift: number;
  rotate: number;
  delay: number;
  size: number;
  color: string;
  round: boolean;
}

function seeded(index: number, salt: number): number {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function Piece({ particle, height, duration }: { particle: Particle; height: number; duration: number }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.set(withDelay(particle.delay, withTiming(1, { duration, easing: Easing.out(Easing.quad) })));
  }, [duration, particle.delay, t]);

  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.85 ? 1 : (1 - t.value) / 0.15,
    transform: [
      { translateX: particle.x + particle.drift * t.value },
      { translateY: -40 + (height + 80) * t.value * t.value },
      { rotate: `${particle.rotate * t.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          width: particle.size,
          height: particle.round ? particle.size : particle.size * 0.45,
          borderRadius: particle.round ? particle.size / 2 : 2,
          backgroundColor: particle.color,
        },
        style,
      ]}
    />
  );
}

export interface ConfettiProps {
  /** Change this value to fire a new burst. */
  fireKey: number | string;
  count?: number;
  duration?: number;
}

/** Rare delight moment only (first result, reward). Skipped entirely under Reduce Motion. */
export function Confetti({ fireKey, count = 70, duration = 2400 }: ConfettiProps) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: seeded(i, 1) * width,
        drift: (seeded(i, 2) - 0.5) * 160,
        rotate: (seeded(i, 3) - 0.5) * 900,
        delay: seeded(i, 4) * 350,
        size: 7 + seeded(i, 5) * 7,
        color: PALETTE[i % PALETTE.length] ?? colors.primary,
        round: seeded(i, 6) > 0.7,
      })),
    // fireKey regenerates the burst
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [count, width, fireKey],
  );

  if (reduceMotion || fireKey === 0 || fireKey === '') return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden>
      {particles.map((particle, index) => (
        <Piece key={`${fireKey}-${index}`} particle={particle} height={height} duration={duration} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', top: 0, left: 0 },
});
