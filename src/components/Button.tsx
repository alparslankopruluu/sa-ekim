import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
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

import { colors, glows, gradients, minTouch, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { EqualizerBars } from './EqualizerBars';
import { PressableScale } from './PressableScale';

type Variant = 'primary' | 'gold' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  /** Periodic light sweep on the primary CTA (money path). Off under Reduce Motion. */
  shine?: boolean;
  size?: 'lg' | 'md' | 'sm';
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  testID?: string;
}

function Shine({ width }: { width: number }) {
  const progress = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion || width === 0) return;
    progress.set(withRepeat(
      withSequence(
        withDelay(2200, withTiming(1, { duration: 900, easing: Easing.inOut(Easing.cubic) })),
        withTiming(0, { duration: 0 }),
      ),
      -1,
    ));
    return () => cancelAnimation(progress);
  }, [progress, reduceMotion, width]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: -120 + progress.value * (width + 240) }, { skewX: '-20deg' }],
  }));

  if (reduceMotion) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.shine, style]}>
      <LinearGradient
        colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

const HEIGHTS = { lg: 58, md: 48, sm: 40 } as const;
/** Large enough to stay a pill when the label wraps at accessibility text sizes. */
const PILL = 999;
/** Labels still grow with Dynamic Type, but stop before they break the pill. */
const LABEL_SCALE_CAP = 1.5;

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  shine = false,
  size = 'lg',
  style,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const [width, setWidth] = useState(0);
  const height = Math.max(HEIGHTS[size], size === 'sm' ? 40 : minTouch);
  const filled = variant === 'primary' || variant === 'gold';
  const textColor = variant === 'gold' ? 'textOnAccent' : variant === 'danger' ? 'danger' : 'text';

  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={[
        styles.base,
        { minHeight: height, borderRadius: PILL },
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        variant === 'danger' && styles.dangerOutline,
        variant === 'primary' && !disabled && { boxShadow: glows.primary },
        variant === 'gold' && !disabled && { boxShadow: glows.gold },
        style,
      ]}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {filled ? (
        <LinearGradient
          colors={variant === 'gold' ? gradients.gold : gradients.cta}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: PILL }]}
        />
      ) : null}
      {filled && shine && !loading ? (
        <View style={[StyleSheet.absoluteFill, styles.clip, { borderRadius: PILL }]}>
          <Shine width={width} />
        </View>
      ) : null}
      <View style={styles.content}>
        {loading ? (
          <EqualizerBars bars={4} height={18} color={textColor} />
        ) : (
          <>
            {icon ? <Ionicons name={icon} size={size === 'sm' ? 16 : 20} color={colors[textColor]} /> : null}
            <AppText
              variant={size === 'sm' ? 'callout' : 'headline'}
              color={textColor}
              align="center"
              numberOfLines={2}
              maxFontSizeMultiplier={LABEL_SCALE_CAP}
              style={styles.label}
            >
              {label}
            </AppText>
          </>
        )}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: minTouch,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.sm,
  },
  label: { flexShrink: 1 },
  clip: { overflow: 'hidden' },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  secondary: {
    backgroundColor: colors.surfaceHigh,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.strokeStrong,
  },
  ghost: { backgroundColor: colors.transparent },
  dangerOutline: {
    backgroundColor: colors.transparent,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  shine: {
    position: 'absolute',
    top: -10,
    bottom: -10,
    width: 90,
  },
});

