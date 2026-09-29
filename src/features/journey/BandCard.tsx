import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { Goal } from '@shared/catalog';

import { AppText } from '@/components/AppText';
import { PressableScale } from '@/components/PressableScale';
import { colors, radius, spacing } from '@/theme/tokens';

import { openPaywall, useJourneyAccess } from './access';
import { PhaseBandChart } from './PhaseBandChart';
import type { JourneyView } from './useJourneyView';

/** The phase band with its paywall gate: Pro sees it, free sees it softly blurred with a lock chip. */
export function BandCard({
  view,
  goal,
  title,
  height,
  linkToTimeline = false,
}: {
  view: JourneyView;
  goal: Goal;
  title: string;
  height?: number;
  linkToTimeline?: boolean;
}) {
  const { t } = useTranslation();
  const access = useJourneyAccess();
  const locked = access.loaded && !access.band.allowed;
  const clock = view.clock;
  const day = clock.status === 'active' || clock.status === 'complete' ? clock.day : null;
  const phaseId = clock.status === 'active' ? clock.phase.id : null;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <AppText variant="headline" accessibilityRole="header" style={styles.title}>
          {title}
        </AppText>
        {linkToTimeline ? (
          <PressableScale
            onPress={() => router.push('/(tabs)/journey')}
            accessibilityLabel={t('journey.band.seeTimeline')}
            style={styles.link}
          >
            <AppText variant="callout" color="primary">
              {t('journey.band.seeTimeline')}
            </AppText>
          </PressableScale>
        ) : null}
      </View>
      <PhaseBandChart
        day={day}
        goal={goal}
        phaseId={phaseId}
        height={height}
        locked={locked}
        onLockedPress={() => openPaywall(access.band.paywallSource ?? 'locked_band', 'band')}
      />
    </View>
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
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1 },
  link: { minHeight: 44, justifyContent: 'center' },
});
