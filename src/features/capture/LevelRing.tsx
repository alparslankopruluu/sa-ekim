/**
 * Spirit-level ring: the bubble follows the tilt (shared values from the gate) and the ring
 * turns sage when the phone is in position. Under Reduce Motion the bubble moves without a
 * spring.
 */
import { StyleSheet, View } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  withSpring,
} from 'react-native-reanimated';

import { springs } from '@/theme/motion';
import { colors } from '@/theme/tokens';

const SIZE = 56;
const BUBBLE = 14;
const TRAVEL = (SIZE - BUBBLE) / 2 - 3;

export function LevelRing({ x, y, ok }: { x: SharedValue<number>; y: SharedValue<number>; ok: boolean }) {
  const reduceMotion = useReducedMotion();
  const bubble = useAnimatedStyle(() => {
    const tx = x.get() * TRAVEL;
    const ty = y.get() * TRAVEL;
    return {
      transform: reduceMotion
        ? [{ translateX: tx }, { translateY: ty }]
        : [{ translateX: withSpring(tx, springs.snappy) }, { translateY: withSpring(ty, springs.snappy) }],
    };
  });

  return (
    <View
      style={[styles.ring, { borderColor: ok ? colors.sage : colors.strokeStrong }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.target, { borderColor: ok ? colors.sage : colors.textTertiary }]} />
      <Animated.View style={[styles.bubble, { backgroundColor: ok ? colors.sage : colors.accent }, bubble]} />
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.scrim,
  },
  target: {
    position: 'absolute',
    width: BUBBLE + 6,
    height: BUBBLE + 6,
    borderRadius: (BUBBLE + 6) / 2,
    borderWidth: 1,
  },
  bubble: { position: 'absolute', width: BUBBLE, height: BUBBLE, borderRadius: BUBBLE / 2 },
});
