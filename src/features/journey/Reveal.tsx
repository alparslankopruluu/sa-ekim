import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { durations, stagger } from '@/theme/motion';

/**
 * Calm staggered entrance for a screen block. Reanimated skips layout animations when the
 * system "Reduce Motion" setting is on (default `ReduceMotion.System`), so this degrades to
 * an instant appearance without extra code.
 */
export function Reveal({ index = 0, children, style }: { index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={FadeInDown.delay(stagger(index, 70)).duration(durations.slow)} style={style}>
      {children}
    </Animated.View>
  );
}
