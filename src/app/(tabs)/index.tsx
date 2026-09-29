import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { PressableScale } from '@/components/PressableScale';
import { StageBackground } from '@/components/StageBackground';
import { Skeleton } from '@/components/ui';
import { BandCard } from '@/features/journey/BandCard';
import { DayHero } from '@/features/journey/DayHero';
import { NextTaskCard } from '@/features/journey/NextTaskCard';
import { PhaseCard } from '@/features/journey/PhaseCard';
import { PreOpCard, SetDateCard } from '@/features/journey/PreJourneyCard';
import { PreviewEntryCard } from '@/features/journey/PreviewEntryCard';
import { Reveal } from '@/features/journey/Reveal';
import { ShedPeek } from '@/features/journey/ShedPeek';
import { useJourneyView } from '@/features/journey/useJourneyView';
import { usePhaseViewTracking } from '@/features/journey/usePhaseViewTracking';
import CohortCard from '@/features/cohort/CohortCard';
import { GiftHomeCard } from '@/features/gift/GiftHomeCard';
import { currentLocaleTag } from '@/lib/i18n';
import { formatIsoDate, partOfDay } from '@/lib/phaseView';
import { trackScreen } from '@/services/analytics';
import { colors, layout, minTouch, radius, spacing } from '@/theme/tokens';

const SHED_PEEK_LAST_DAY = 70;

export default function TodayScreen() {
  const { t } = useTranslation();
  const view = useJourneyView();
  usePhaseViewTracking(view);

  useEffect(() => {
    trackScreen('today');
  }, []);

  const { clock, kind } = view;
  const locale = currentLocaleTag();
  const greeting = t(`journey.greeting.${partOfDay(view.now)}`);
  const subtitle =
    clock.status === 'unset'
      ? t('journey.today.subtitleUnset')
      : clock.status === 'upcoming' && view.procedureDate
        ? t('journey.today.subtitleUpcoming', { date: formatIsoDate(view.procedureDate, locale, 'long') })
        : view.now.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <View style={styles.root}>
      <StageBackground animated={false} intensity="soft" />
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <AppText variant="title1" accessibilityRole="header" numberOfLines={2}>
              {greeting}
            </AppText>
            <AppText variant="callout" color="textSecondary">
              {subtitle}
            </AppText>
          </View>
          {clock.status !== 'unset' ? (
            <PressableScale
              onPress={() => router.push('/journey-setup')}
              accessibilityLabel={t('journey.today.editDate')}
              style={styles.editButton}
              testID="edit-date"
            >
              <Ionicons name="calendar-outline" size={22} color={colors.text} />
            </PressableScale>
          ) : null}
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {!view.hydrated ? (
            <View style={styles.skeletons} accessibilityLabel={t('common.loading')} accessibilityRole="progressbar">
              <Skeleton style={styles.skelHero} />
              <Skeleton style={styles.skelCard} />
              <Skeleton style={styles.skelCard} />
            </View>
          ) : (
            <>
              {clock.status === 'unset' ? (
                <Reveal index={0}>
                  <SetDateCard kind={kind} />
                </Reveal>
              ) : (
                <Reveal index={0}>
                  <DayHero view={view} />
                </Reveal>
              )}

              {kind === 'transplant' && clock.status === 'active' ? (
                <Reveal index={1}>
                  <PhaseCard
                    phaseId={clock.phase.id}
                    anxious={clock.phase.anxious}
                    nextPhaseId={clock.next?.id ?? null}
                    daysToNext={clock.daysToNext}
                  />
                </Reveal>
              ) : null}

              {kind === 'transplant' && clock.status === 'upcoming' ? (
                <Reveal index={1}>
                  <PreOpCard />
                </Reveal>
              ) : null}

              {clock.status !== 'unset' ? <NextTaskCard view={view} index={2} /> : null}

              {kind === 'transplant' &&
              clock.status === 'active' &&
              clock.day >= 15 &&
              clock.day <= SHED_PEEK_LAST_DAY &&
              view.shed.length > 0 ? (
                <Reveal index={3}>
                  <ShedPeek />
                </Reveal>
              ) : null}

              {kind === 'transplant' && clock.status === 'active' ? (
                <Reveal index={4}>
                  <BandCard
                    view={view}
                    goal={view.goal}
                    title={t('journey.today.bandTitle')}
                    height={120}
                    linkToTimeline
                  />
                </Reveal>
              ) : null}

              {clock.status !== 'unset' ? (
                <Reveal index={5}>
                  <CohortCard />
                </Reveal>
              ) : null}

              <Reveal index={6}>
                <PreviewEntryCard />
              </Reveal>

              <Reveal index={7}>
                <GiftHomeCard />
              </Reveal>
            </>
          )}
          <View style={styles.bottom} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerText: { flex: 1, gap: spacing.xxs },
  editButton: {
    width: minTouch,
    height: minTouch,
    borderRadius: minTouch / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke,
  },
  scroll: {
    paddingHorizontal: layout.screenPadding,
    gap: spacing.xl,
    paddingTop: spacing.sm,
    maxWidth: layout.maxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  skeletons: { gap: spacing.xl },
  skelHero: { height: 220, borderRadius: radius.xl },
  skelCard: { height: 150, borderRadius: radius.lg },
  bottom: { height: layout.tabBarClearance },
});
