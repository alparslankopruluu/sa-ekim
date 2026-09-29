import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { colors, glows, minTouch, radius, spacing } from '@/theme/tokens';
import { springs } from '@/theme/motion';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

export interface OptionCardProps {
  title: string;
  subtitle?: string;
  emoji?: string;
  selected: boolean;
  onPress: () => void;
  gradient?: readonly [string, string];
  badge?: string;
  testID?: string;
}

/** Single-tap choice card with an animated check (onboarding goals, subjects, voices). */
export function OptionCard({ title, subtitle, emoji, selected, onPress, gradient, badge, testID }: OptionCardProps) {
  const { t } = useTranslation();
  const check = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    check.set(selected ? withSpring(1, springs.bouncy) : withTiming(0, { duration: 140 }));
  }, [check, selected]);

  const checkStyle = useAnimatedStyle(() => ({
    opacity: check.value,
    transform: [{ scale: 0.4 + check.value * 0.6 }],
  }));

  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      haptic="selection"
      accessibilityRole="radio"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityState={{ selected, checked: selected }}
      style={[styles.card, selected && styles.selected, selected && { boxShadow: glows.primary }]}
    >
      {selected && gradient ? (
        <LinearGradient
          colors={[`${gradient[0]}33`, `${gradient[1]}22`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {emoji ? (
        <View style={styles.emojiWrap}>
          <AppText style={styles.emoji} accessibilityElementsHidden importantForAccessibility="no">
            {emoji}
          </AppText>
        </View>
      ) : null}
      <View style={styles.text}>
        <AppText variant="headline">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" color="textSecondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {badge ? (
        <View style={styles.badge}>
          <AppText variant="micro" color="textOnAccent">
            {badge}
          </AppText>
        </View>
      ) : null}
      <Animated.View style={[styles.check, checkStyle]} accessibilityLabel={t('a11y.selected')}>
        <Ionicons name="checkmark" size={16} color={colors.text} />
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: minTouch + 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.stroke,
    overflow: 'hidden',
  },
  selected: { borderColor: colors.primary },
  emojiWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 24, lineHeight: 30 },
  text: { flex: 1, gap: 2 },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
