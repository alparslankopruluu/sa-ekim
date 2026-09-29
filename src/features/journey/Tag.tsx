import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, radius, spacing } from '@/theme/tokens';

/** Small calm pill, e.g. "Expected" on the phases most people worry about. Never a warning colour. */
export function Tag({ label, tone = 'sage' }: { label: string; tone?: 'sage' | 'neutral' | 'gold' }) {
  const color = tone === 'sage' ? colors.sage : tone === 'gold' ? colors.accent : colors.textSecondary;
  return (
    <View style={[styles.tag, { borderColor: color }]}>
      <AppText variant="micro" style={{ color }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
});
