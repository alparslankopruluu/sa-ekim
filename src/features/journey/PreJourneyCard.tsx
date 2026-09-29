import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { colors, radius, spacing } from '@/theme/tokens';

const TIPS = ['tip1', 'tip2', 'tip3', 'tip4'] as const;

/** Empty state before the operation date is set: one clear action, no clutter. */
export function SetDateCard({ kind = 'transplant' }: { kind?: 'transplant' | 'prp' }) {
  const { t } = useTranslation();
  return (
    <View style={styles.card} testID="set-date-card">
      <View style={styles.iconWrap}>
        <Ionicons name="calendar-outline" size={30} color={colors.primary} />
      </View>
      <AppText variant="title2" align="center" accessibilityRole="header">
        {kind === 'prp' ? t('journey.setDate.prpTitle') : t('journey.setDate.title')}
      </AppText>
      <AppText variant="body" color="textSecondary" align="center">
        {kind === 'prp' ? t('journey.setDate.prpBody') : t('journey.setDate.body')}
      </AppText>
      <Button
        label={t('journey.setDate.cta')}
        icon="calendar"
        shine
        onPress={() => router.push('/journey-setup')}
        style={styles.cta}
        testID="set-date-cta"
      />
      <AppText variant="caption" color="textTertiary" align="center">
        {t('journey.setDate.privacy')}
      </AppText>
    </View>
  );
}

/** Pre-operation guidance shown while the operation date is still ahead. */
export function PreOpCard() {
  const { t } = useTranslation();
  return (
    <View style={styles.guide} testID="preop-card">
      <AppText variant="title2" accessibilityRole="header">
        {t('journey.pre.title')}
      </AppText>
      <AppText variant="body" color="textSecondary">
        {t('journey.pre.body')}
      </AppText>
      <View style={styles.tips}>
        {TIPS.map((tip) => (
          <View key={tip} style={styles.tip}>
            <Ionicons name="checkmark-circle-outline" size={20} color={colors.sage} style={styles.tipIcon} />
            <AppText variant="body" style={styles.tipText}>
              {t(`journey.pre.${tip}`)}
            </AppText>
          </View>
        ))}
      </View>
      <AppText variant="caption" color="textTertiary">
        {t('journey.pre.clinicNote')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.strokeStrong,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgElevated,
  },
  cta: { alignSelf: 'stretch', marginTop: spacing.sm },
  guide: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke,
  },
  tips: { gap: spacing.sm },
  tip: { flexDirection: 'row', gap: spacing.md },
  tipIcon: { marginTop: 2 },
  tipText: { flex: 1 },
});
