import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { useAccount } from '@/stores/account';
import { colors, minTouch, radius, spacing } from '@/theme/tokens';

import { AnimatedNumber } from './AnimatedNumber';
import { PressableScale } from './PressableScale';

export function CreditPill({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const balance = useAccount((s) => s.wallet.balance);

  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={t('ui.a11y.balance', { count: balance })}
      accessibilityHint={t('ui.getCredits')}
      style={styles.pill}
      testID="credit-pill"
    >
      <Ionicons name="flash" size={16} color={colors.accent} />
      <AnimatedNumber value={balance} variant="headline" />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: minTouch - 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceHigh,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.strokeStrong,
  },
});
