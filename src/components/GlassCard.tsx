import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/theme/tokens';

const liquidGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

export interface GlassCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  /** Tinted highlight for selected states. */
  tint?: string;
}

/**
 * Liquid Glass on iOS 26+ (expo-glass-effect), a blur material on older iOS,
 * and a translucent surface on Android/web. See docs/decisions.md D-005.
 */
export function GlassCard({ children, style, padded = true, tint }: GlassCardProps) {
  const content = <View style={padded ? styles.padding : undefined}>{children}</View>;

  if (liquidGlass) {
    return (
      <GlassView glassEffectStyle="regular" tintColor={tint} style={[styles.card, style]}>
        {content}
      </GlassView>
    );
  }

  if (Platform.OS === 'ios') {
    return (
      <View style={[styles.card, styles.border, style]}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        {tint ? <View style={[StyleSheet.absoluteFill, { backgroundColor: tint, opacity: 0.18 }]} /> : null}
        {content}
      </View>
    );
  }

  return (
    <View style={[styles.card, styles.border, styles.fallback, style]}>
      {tint ? <View style={[StyleSheet.absoluteFill, { backgroundColor: tint, opacity: 0.16 }]} /> : null}
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  border: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.strokeStrong,
  },
  fallback: {
    backgroundColor: 'rgba(42,33,24,0.72)',
  },
  padding: { padding: spacing.lg },
});
