import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ANGLES_BY_GOAL } from '@shared/catalog';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { currentLocaleTag } from '@/lib/i18n';
import { type CheckpointStatus, checkpointsFor, formatIsoDate, photoDay } from '@/lib/phaseView';
import { colors, radius, spacing } from '@/theme/tokens';

import { useStartCapture } from './access';
import { SetDateCard } from './PreJourneyCard';
import { PrpPlanner } from './PrpPlanner';
import { Tag } from './Tag';
import type { JourneyView } from './useJourneyView';

const LONG_DATE = 'long' as const;

const TONE: Record<CheckpointStatus, 'sage' | 'gold' | 'neutral'> = {
  done: 'sage',
  due: 'gold',
  upcoming: 'neutral',
  missed: 'neutral',
};

/** Plan tab: the PRP course planner, or the 3/6/9/12(/18)-month photo checkpoints for a transplant. */
export function PlanTab({ view }: { view: JourneyView }) {
  const { t } = useTranslation();
  const startCapture = useStartCapture();
  const locale = currentLocaleTag();

  if (view.kind === 'prp') return <PrpPlanner view={view} />;
  if (view.clock.status === 'unset') return <SetDateCard />;

  const procedureDate = view.procedureDate;
  const day = view.clock.status === 'upcoming' ? -1 : view.clock.day;
  const photoDays = procedureDate ? view.photos.map((p) => photoDay(p, procedureDate)) : [];
  const checkpoints = checkpointsFor(view.goal, procedureDate, photoDays, day);
  const angle = ANGLES_BY_GOAL[view.goal][0] ?? 'front';

  return (
    <View style={styles.stack}>
      <AppText variant="body" color="textSecondary">
        {t('journey.plan.intro')}
      </AppText>
      {checkpoints.map((checkpoint) => {
        const date = checkpoint.date ? formatIsoDate(checkpoint.date, locale, LONG_DATE) : null;
        const label = t('journey.plan.checkpoint', { month: checkpoint.month });
        const status = t(`journey.plan.status.${checkpoint.status}`);
        const actionable = checkpoint.status === 'due' || checkpoint.status === 'missed';
        return (
          <View
            key={checkpoint.month}
            style={[styles.card, checkpoint.status === 'due' && styles.cardDue]}
            accessible
            accessibilityLabel={`${label}. ${date ?? ''}. ${status}`}
            testID={`checkpoint-${checkpoint.month}`}
          >
            <View style={styles.head}>
              <View style={styles.text}>
                <AppText variant="headline">{label}</AppText>
                {date ? (
                  <AppText variant="callout" color="textSecondary">
                    {date}
                  </AppText>
                ) : null}
              </View>
              <Tag label={status} tone={TONE[checkpoint.status]} />
            </View>
            {actionable ? (
              <Button
                label={t('journey.plan.takePhoto')}
                icon="camera"
                size="sm"
                variant="secondary"
                onPress={() => startCapture(angle)}
              />
            ) : null}
          </View>
        );
      })}
      <AppText variant="caption" color="textTertiary">
        {t('journey.plan.note')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke,
  },
  cardDue: { borderColor: colors.accent, borderWidth: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1, gap: 2 },
});
