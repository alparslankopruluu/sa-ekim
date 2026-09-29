import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { PressableScale } from '@/components/PressableScale';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { Skeleton } from '@/components/ui';
import { PhotosTab } from '@/features/journey/PhotosTab';
import { PlanTab } from '@/features/journey/PlanTab';
import { TimelineTab } from '@/features/journey/TimelineTab';
import { useJourneyView } from '@/features/journey/useJourneyView';
import { trackScreen } from '@/services/analytics';
import { exportClinicReport } from '@/services/report';
import { colors, layout, minTouch, radius, spacing } from '@/theme/tokens';

type TabId = 'timeline' | 'photos' | 'plan';

function isTabId(value: unknown): value is TabId {
  return value === 'timeline' || value === 'photos' || value === 'plan';
}

export default function JourneyScreen() {
  const { t } = useTranslation();
  const view = useJourneyView();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [chosen, setChosen] = useState<TabId | null>(null);
  const [exporting, setExporting] = useState(false);
  const tab: TabId = chosen ?? (isTabId(params.tab) ? params.tab : view.kind === 'prp' ? 'plan' : 'timeline');

  useEffect(() => {
    trackScreen('journey');
  }, []);

  const tabs = [
    { id: 'timeline', label: t('journey.tabs.timeline') },
    {
      id: 'photos',
      label: t('journey.tabs.photos'),
      badge: view.photos.length > 0 ? String(view.photos.length) : undefined,
    },
    { id: 'plan', label: t('journey.tabs.plan') },
  ] as const;

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.header}>
          <AppText variant="title1" accessibilityRole="header" style={styles.title}>
            {t('nav.journey')}
          </AppText>
          <PressableScale
            onPress={() => {
              if (exporting) return;
              setExporting(true);
              void exportClinicReport().finally(() => setExporting(false));
            }}
            disabled={exporting}
            accessibilityLabel={t('report.clinic.action')}
            style={styles.editButton}
            testID="journey-report"
          >
            <Ionicons name="document-text-outline" size={22} color={colors.text} />
          </PressableScale>
          <PressableScale
            onPress={() => router.push('/journey-setup')}
            accessibilityLabel={t('journey.today.editDate')}
            style={styles.editButton}
            testID="journey-edit"
          >
            <Ionicons name="calendar-outline" size={22} color={colors.text} />
          </PressableScale>
        </View>
        <View style={styles.tabs}>
          <SegmentedTabs tabs={tabs} value={tab} onChange={setChosen} />
        </View>

        {!view.hydrated ? (
          <View style={styles.skeletons} accessibilityRole="progressbar" accessibilityLabel={t('common.loading')}>
            <Skeleton style={styles.skelBand} />
            <Skeleton style={styles.skelCard} />
            <Skeleton style={styles.skelCard} />
          </View>
        ) : tab === 'photos' ? (
          <PhotosTab view={view} />
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {tab === 'timeline' ? (
              <TimelineTab view={view} onOpenPlan={() => setChosen('plan')} />
            ) : (
              <PlanTab view={view} />
            )}
            <View style={styles.bottom} />
          </ScrollView>
        )}
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
  title: { flex: 1 },
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
  tabs: { paddingHorizontal: layout.screenPadding, paddingBottom: spacing.lg },
  scroll: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.xs,
    maxWidth: layout.maxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  skeletons: { gap: spacing.lg, paddingHorizontal: layout.screenPadding },
  skelBand: { height: 200, borderRadius: radius.lg },
  skelCard: { height: 110, borderRadius: radius.lg },
  bottom: { height: layout.tabBarClearance },
});
