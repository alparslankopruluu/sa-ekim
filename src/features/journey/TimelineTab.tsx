import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { maturationMonthsFor } from '@shared/catalog';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { currentLocaleTag } from '@/lib/i18n';
import { phaseSchedule } from '@/lib/phaseView';
import { colors, radius, spacing } from '@/theme/tokens';

import { useJourneyAccess } from './access';
import { BandCard } from './BandCard';
import { PhaseRail } from './PhaseRail';
import { Reveal } from './Reveal';
import { SetDateCard } from './PreJourneyCard';
import type { JourneyView } from './useJourneyView';

/** Timeline tab: the band, every phase with dates, and the maturation note. */
export function TimelineTab({ view, onOpenPlan }: { view: JourneyView; onOpenPlan: () => void }) {
  const { t } = useTranslation();
  const access = useJourneyAccess();
  const locale = currentLocaleTag();

  if (view.kind === 'prp') {
    return (
      <View style={styles.stack}>
        <Reveal index={0}>
          <View style={styles.note}>
            <AppText variant="title2" accessibilityRole="header">
              {t('journey.prp.timelineTitle')}
            </AppText>
            <AppText variant="body" color="textSecondary">
              {t('journey.prp.timelineBody')}
            </AppText>
            <Button label={t('journey.prp.openPlan')} variant="secondary" size="md" onPress={onOpenPlan} />
          </View>
        </Reveal>
      </View>
    );
  }

  const { clock, goal } = view;
  const rows = phaseSchedule(view.procedureDate, goal);
  const months = maturationMonthsFor(goal);
  const currentId = clock.status === 'active' ? clock.phase.id : null;
  const day = clock.status === 'active' || clock.status === 'complete' ? clock.day : null;

  return (
    <View style={styles.stack}>
      {clock.status === 'unset' ? (
        <Reveal index={0}>
          <SetDateCard />
        </Reveal>
      ) : null}
      <Reveal index={1}>
        <BandCard view={view} goal={goal} title={t('journey.timeline.bandTitle')} height={168} />
      </Reveal>
      <Reveal index={2}>
        <AppText variant="title2" accessibilityRole="header" style={styles.heading}>
          {t('journey.timeline.phasesTitle')}
        </AppText>
        <PhaseRail
          rows={rows}
          currentId={currentId}
          day={day}
          locale={locale}
          showLocks={access.loaded && !access.isPro}
        />
      </Reveal>
      <Reveal index={3}>
        <View style={styles.note}>
          <AppText variant="headline">{t('journey.maturation.title')}</AppText>
          <AppText variant="body" color="textSecondary">
            {t('journey.maturation.note', { months })}
          </AppText>
          <AppText variant="body" color="textSecondary">
            {months === 18 ? t('journey.maturation.evaluate18') : t('journey.maturation.evaluate12')}
          </AppText>
          <AppText variant="caption" color="textTertiary">
            {t('journey.maturation.clinicNote')}
          </AppText>
        </View>
      </Reveal>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.xl },
  heading: { marginBottom: spacing.md },
  note: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke,
  },
});
