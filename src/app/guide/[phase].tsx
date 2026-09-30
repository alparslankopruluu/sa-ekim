import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { I18nManager, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { PhaseId } from '@shared/timeline';
import { PHASES, weekIndex } from '@shared/timeline';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { PressableScale } from '@/components/PressableScale';
import { ProgressRing } from '@/components/ProgressRing';
import { EmptyState, IconButton, Skeleton } from '@/components/ui';
import { openPaywall, useJourneyAccess } from '@/features/journey/access';
import { Reveal } from '@/features/journey/Reveal';
import { Tag } from '@/features/journey/Tag';
import { useJourneyView } from '@/features/journey/useJourneyView';
import { CARE_RANGES, type CareRange, careRangeFor, endDayFor, isPhaseId } from '@/lib/phaseView';
import { trackScreen } from '@/services/analytics';
import { colors, layout, minTouch, radius, spacing } from '@/theme/tokens';

const TODOS = ['todo1', 'todo2', 'todo3', 'todo4'] as const;
const FLAGS = ['fever', 'redness', 'pus', 'pain', 'bleeding'] as const;
const CARE_TOPICS = ['wash', 'sleep', 'avoid'] as const;

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/(tabs)');
}

function Section({ title, children, index }: { title: string; children: React.ReactNode; index: number }) {
  return (
    <Reveal index={index} style={styles.section}>
      <AppText variant="title2" accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </Reveal>
  );
}

function CareAccordion({ initial }: { initial: CareRange }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<CareRange | null>(initial);
  return (
    <View style={styles.accordion}>
      <AppText variant="callout" color="textSecondary">
        {t('guide.care.days.intro')}
      </AppText>
      {CARE_RANGES.map((range) => {
        const expanded = open === range;
        return (
          <View key={range} style={styles.accItem}>
            <PressableScale
              onPress={() => setOpen(expanded ? null : range)}
              pressedScale={0.99}
              haptic="selection"
              accessibilityLabel={t(`guide.care.days.${range}.title`)}
              accessibilityState={{ expanded }}
              style={styles.accHead}
              testID={`care-range-${range}`}
            >
              <AppText variant="headline" style={styles.flex}>
                {t(`guide.care.days.${range}.title`)}
              </AppText>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textSecondary} />
            </PressableScale>
            {expanded ? (
              <Animated.View entering={FadeIn.duration(200)} style={styles.accBody}>
                {CARE_TOPICS.map((topic) => (
                  <View key={topic} style={styles.accRow}>
                    <AppText variant="caption" color="primary">
                      {t(`guide.sections.${topic}`)}
                    </AppText>
                    <AppText variant="body" color="textSecondary">
                      {t(`guide.care.days.${range}.${topic}`)}
                    </AppText>
                  </View>
                ))}
              </Animated.View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/** Phase guide: what happens, what is typical, this week's to-dos, red flags and (for `care`) day-by-day care. */
export default function GuideScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ phase?: string }>();
  const view = useJourneyView();
  const access = useJourneyAccess();
  const phaseId: PhaseId | null = isPhaseId(params.phase) ? params.phase : null;

  useEffect(() => {
    if (phaseId) trackScreen(`guide_${phaseId}`);
  }, [phaseId]);

  const header = (
    <View style={styles.topBar}>
      <IconButton
        icon={I18nManager.isRTL ? 'chevron-forward' : 'chevron-back'}
        onPress={goBack}
        label={t('common.back')}
        testID="guide-back"
      />
    </View>
  );

  const def = PHASES.find((p) => p.id === phaseId);
  if (!phaseId || !def) {
    return (
      <SafeAreaView edges={['top']} style={styles.root}>
        {header}
        <EmptyState
          emoji={'🧭'}
          title={t('guide.notFound.title')}
          body={t('guide.notFound.body')}
          action={{ label: t('guide.notFound.cta'), onPress: goBack }}
        />
      </SafeAreaView>
    );
  }

  const toDay = Math.min(def.toDay, endDayFor(view.goal));
  const clock = view.clock;
  const day = clock.status === 'active' || clock.status === 'complete' ? clock.day : null;
  const current = clock.status === 'active' && clock.phase.id === phaseId;
  const past = day !== null && day > toDay;
  const progress = current && day !== null ? (day - def.fromDay + 1) / (toDay - def.fromDay + 1) : past ? 1 : 0;
  const state = current ? t('guide.header.current') : past ? t('guide.header.past') : t('guide.header.upcoming');
  const title = t(`guide.${phaseId}.title`);
  const range = t('guide.header.days', { from: def.fromDay, to: toDay });
  const weeks = t('guide.header.weeks', {
    from: weekIndex(def.fromDay),
    to: weekIndex(toDay),
  });
  const gate = access.guide(phaseId);
  const careRange = (day !== null ? careRangeFor(day) : null) ?? 'd0_3';

  return (
    <SafeAreaView edges={['top']} style={styles.root}>
      {header}
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Reveal index={0} style={styles.hero}>
          <View
            accessible
            accessibilityRole="header"
            accessibilityLabel={`${title}. ${range}. ${state}.`}
            style={styles.heroInner}
          >
            <ProgressRing progress={progress} size={112} stroke={8}>
              <AppText variant="micro" color="textTertiary">
                {t('guide.header.week')}
              </AppText>
              <AppText variant="title2">{String(weekIndex(current && day !== null ? day : def.fromDay))}</AppText>
            </ProgressRing>
            <View style={styles.heroText}>
              <View style={styles.tags}>
                <Tag label={state} tone={current ? 'gold' : 'neutral'} />
                {def.anxious ? <Tag label={t('journey.phase.expected')} /> : null}
              </View>
              <AppText variant="title1">{title}</AppText>
              <AppText variant="callout" color="textSecondary">
                {t(`guide.${phaseId}.tagline`)}
              </AppText>
              <AppText variant="caption" color="textTertiary">
                {`${range} · ${weeks}`}
              </AppText>
            </View>
          </View>
        </Reveal>

        <Reveal index={1} style={styles.normal}>
          <View style={styles.normalHead}>
            <Ionicons name="leaf-outline" size={20} color={colors.sage} />
            <AppText variant="headline" color="sage">
              {t('guide.sections.normal')}
            </AppText>
          </View>
          <AppText variant="body">{t(`guide.${phaseId}.normal`)}</AppText>
          <AppText variant="caption" color="textSecondary">
            {t('journey.phase.clinicNote')}
          </AppText>
        </Reveal>

        {!access.loaded ? (
          <View style={styles.section} accessibilityRole="progressbar" accessibilityLabel={t('common.loading')}>
            <Skeleton style={styles.skel} />
            <Skeleton style={styles.skel} />
          </View>
        ) : !gate.allowed ? (
          <Reveal index={2} style={styles.lock}>
            <Ionicons name="lock-closed" size={26} color={colors.accent} />
            <AppText variant="title2" align="center">
              {t('guide.lock.title')}
            </AppText>
            <AppText variant="body" color="textSecondary" align="center">
              {t('guide.lock.body')}
            </AppText>
            <Button
              label={t('guide.lock.cta')}
              variant="gold"
              onPress={() => openPaywall(gate.paywallSource ?? 'locked_guide', 'guide')}
              style={styles.lockCta}
              testID="guide-unlock"
            />
            <AppText variant="caption" color="textTertiary" align="center">
              {t('guide.lock.redflagsNote')}
            </AppText>
          </Reveal>
        ) : (
          <>
            <Section title={t('guide.sections.happening')} index={2}>
              <AppText variant="body" color="textSecondary">
                {t(`guide.${phaseId}.happening`)}
              </AppText>
            </Section>

            <Section title={t('guide.sections.todo')} index={3}>
              <View style={styles.list}>
                {TODOS.map((key) => (
                  <View key={key} style={styles.bullet}>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={20}
                      color={colors.primary}
                      style={styles.bulletIcon}
                    />
                    <AppText variant="body" style={styles.flex}>
                      {t(`guide.${phaseId}.${key}`)}
                    </AppText>
                  </View>
                ))}
              </View>
            </Section>

            {phaseId === 'care' ? (
              <Section title={t('guide.sections.care')} index={4}>
                <CareAccordion initial={careRange} />
              </Section>
            ) : null}
          </>
        )}

        {/* Safety copy is never behind the paywall. */}
        <Reveal index={5} style={styles.flags}>
          <View style={styles.normalHead}>
            <Ionicons name="call-outline" size={20} color={colors.text} />
            <AppText variant="headline" accessibilityRole="header">
              {t('guide.sections.redflags')}
            </AppText>
          </View>
          <AppText variant="callout" color="textSecondary">
            {t(`guide.${phaseId}.redflags`)}
          </AppText>
          <View style={styles.list}>
            {FLAGS.map((flag) => (
              <View key={flag} style={styles.bullet}>
                <View style={styles.dot} />
                <AppText variant="body" style={styles.flex}>
                  {t(`guide.flags.${flag}`)}
                </AppText>
              </View>
            ))}
          </View>
          <AppText variant="bodyStrong">{t('guide.flags.contact')}</AppText>
        </Reveal>

        <AppText variant="caption" color="textTertiary" style={styles.disclaimer}>
          {t('guide.disclaimer')}
        </AppText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.sm,
  },
  scroll: {
    gap: spacing.xl,
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.giant,
    maxWidth: layout.maxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  hero: {},
  heroInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  heroText: { flex: 1, gap: spacing.xs },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  normal: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.sageDeep,
  },
  normalHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  section: { gap: spacing.md },
  list: { gap: spacing.sm },
  bullet: { flexDirection: 'row', gap: spacing.md },
  bulletIcon: { marginTop: 2 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 9,
    backgroundColor: colors.textSecondary,
  },
  accordion: { gap: spacing.sm },
  accItem: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke,
    overflow: 'hidden',
  },
  accHead: {
    minHeight: minTouch + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  accBody: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  accRow: { gap: spacing.xxs },
  lock: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  lockCta: { alignSelf: 'stretch' },
  flags: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceHigh,
  },
  skel: { height: 96, borderRadius: radius.lg },
  disclaimer: { marginTop: spacing.sm },
});
