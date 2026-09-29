import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { Goal, StyleDef } from '@shared/catalog';

import { AppText } from '@/components/AppText';
import { PressableScale } from '@/components/PressableScale';
import { colors, glows, minTouch, palettes, radius, spacing } from '@/theme/tokens';

const GOAL_ICON: Record<Goal, keyof typeof Ionicons.glyphMap> = {
  hairline: 'happy-outline',
  crown: 'ellipse-outline',
  part: 'git-branch-outline',
  brows: 'eye-outline',
  beard: 'man-outline',
};

export interface StyleCardProps {
  style: StyleDef;
  selected: boolean;
  onPress: () => void;
}

/** One selectable preview style: palette swatch, localized name + one-liner, best-angle hint. */
export function StyleCard({ style, selected, onPress }: StyleCardProps) {
  const { t } = useTranslation();
  const name = t(`preview.styles.${style.id}.name`);
  const description = t(`preview.styles.${style.id}.description`);
  const hint = t('preview.bestAngle', { angle: t(`preview.angles.${style.bestAngle}`) });
  const [from, to] = palettes[style.palette];

  return (
    <PressableScale
      onPress={onPress}
      haptic="selection"
      accessibilityRole="radio"
      accessibilityLabel={`${name}. ${description}. ${hint}`}
      accessibilityState={{ selected, checked: selected }}
      style={[styles.card, selected && styles.selected, selected && { boxShadow: glows.primary }]}
      testID={`style-${style.id}`}
    >
      <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.swatch}>
        <Ionicons name={GOAL_ICON[style.goal]} size={24} color={colors.textOnAccent} />
      </LinearGradient>
      <View style={styles.text}>
        <AppText variant="headline">{name}</AppText>
        <AppText variant="caption" color="textSecondary">
          {description}
        </AppText>
        {selected ? (
          <View style={styles.hint}>
            <Ionicons name="camera-outline" size={13} color={colors.accent} />
            <AppText variant="caption" color="accent" style={styles.hintText}>
              {hint}
            </AppText>
          </View>
        ) : null}
      </View>
      <View style={[styles.radio, selected && styles.radioOn]}>
        {selected ? <Ionicons name="checkmark" size={16} color={colors.textOnAccent} /> : null}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: minTouch + 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.stroke,
  },
  selected: { borderColor: colors.primary, backgroundColor: colors.surfaceHigh },
  swatch: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: spacing.xxs },
  hint: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  hintText: { flexShrink: 1 },
  radio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: colors.strokeStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { backgroundColor: colors.primary, borderColor: colors.primary },
});
