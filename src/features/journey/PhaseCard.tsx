import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { PhaseId } from '@shared/timeline';

import { AppText } from '@/components/AppText';
import { PressableScale } from '@/components/PressableScale';
import { colors, radius, spacing } from '@/theme/tokens';

import { Chevron } from './Chevron';
import { Tag } from './Tag';

export interface PhaseCardProps {
  phaseId: PhaseId;
  anxious: boolean;
  nextPhaseId: PhaseId | null;
  /** Whole days until the next phase starts (shown as text, never a live countdown). */
  daysToNext: number;
}

/** Current phase: title, one calm "what is normal right now" sentence and when the next phase begins. */
export function PhaseCard({ phaseId, anxious, nextPhaseId, daysToNext }: PhaseCardProps) {
  const { t } = useTranslation();
  const title = t(`guide.${phaseId}.title`);
  const normal = t(`guide.${phaseId}.normal`);
  const footer = nextPhaseId
    ? t('journey.phase.nextIn', { phase: t(`guide.${nextPhaseId}.title`), count: daysToNext })
    : t('journey.phase.last');

  return (
    <PressableScale
      onPress={() => router.push({ pathname: '/guide/[phase]', params: { phase: phaseId } })}
      pressedScale={0.985}
      accessibilityLabel={`${t('journey.phase.rightNow')}: ${title}. ${normal} ${t('journey.phase.clinicNote')} ${footer}`}
      accessibilityHint={t('journey.phase.openGuide')}
      style={styles.card}
      testID="phase-card"
    >
      <View style={styles.headRow}>
        <AppText variant="micro" color="textTertiary">
          {t('journey.phase.rightNow')}
        </AppText>
        {anxious ? <Tag label={t('journey.phase.expected')} /> : null}
      </View>
      <AppText variant="title2">{title}</AppText>
      <View style={styles.normal}>
        <Ionicons name="leaf-outline" size={18} color={colors.sage} style={styles.icon} />
        <View style={styles.normalText}>
          <AppText variant="caption" color="sage">
            {t('journey.phase.normalLabel')}
          </AppText>
          <AppText variant="body" color="textSecondary">
            {normal}
          </AppText>
          <AppText variant="caption" color="textTertiary">
            {t('journey.phase.clinicNote')}
          </AppText>
        </View>
      </View>
      <View style={styles.footer}>
        <AppText variant="callout" color="textSecondary" style={styles.footerText}>
          {footer}
        </AppText>
        <Chevron />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  normal: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
  },
  icon: { marginTop: 2 },
  normalText: { flex: 1, gap: spacing.xxs },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  footerText: { flex: 1 },
});
