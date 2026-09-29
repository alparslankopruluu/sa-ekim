import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { colors, minTouch, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

export interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  gradient?: readonly [string, string];
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Chip({ label, selected, onPress, gradient, disabled, style, testID }: ChipProps) {
  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      haptic="selection"
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled: !!disabled }}
      style={[styles.chip, selected && styles.selected, style]}
    >
      {selected ? (
        <LinearGradient
          colors={gradient ?? [colors.primary, colors.orange]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.gradient]}
        />
      ) : null}
      <AppText variant="bodyStrong" color={selected ? 'text' : 'textSecondary'}>
        {label}
      </AppText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: minTouch,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.stroke,
    overflow: 'hidden',
  },
  selected: { borderColor: colors.transparent },
  gradient: { borderRadius: radius.pill },
});
