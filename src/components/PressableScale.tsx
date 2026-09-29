import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';

import { useFeedback } from '@/hooks/useFeedback';
import { springs } from '@/theme/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Scale while pressed (0.96 default; 1 disables). */
  pressedScale?: number;
  haptic?: 'tap' | 'selection' | 'none';
}

/** Press feedback on the UI thread: a quick spring scale + a light haptic on release. */
export function PressableScale({
  children,
  style,
  pressedScale = 0.96,
  haptic = 'tap',
  onPressIn,
  onPressOut,
  onPress,
  disabled,
  ...rest
}: PressableScaleProps) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const feedback = useFeedback();
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPressIn={(event) => {
        if (!reduceMotion) scale.set(withSpring(pressedScale, springs.snappy));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withSpring(1, springs.snappy));
        onPressOut?.(event);
      }}
      onPress={(event) => {
        if (haptic === 'tap') feedback.tap();
        if (haptic === 'selection') feedback.selection();
        onPress?.(event);
      }}
      style={[style, animatedStyle, disabled ? { opacity: 0.5 } : null]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
