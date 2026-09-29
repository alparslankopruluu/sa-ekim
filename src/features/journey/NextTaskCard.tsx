import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { PressableScale } from '@/components/PressableScale';
import { chooseNextTask, formatIsoDate } from '@/lib/phaseView';
import { currentLocaleTag } from '@/lib/i18n';
import { useJourney } from '@/stores/journey';
import { colors, minTouch, radius, spacing } from '@/theme/tokens';

import { useStartCapture } from './access';
import { Reveal } from './Reveal';
import { CARE_ITEMS, type CareItem, useJourneyLocal } from './localState';
import type { JourneyView } from './useJourneyView';

function CardShell({
  icon,
  tone = 'copper',
  title,
  body,
  children,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone?: 'copper' | 'sage';
  title: string;
  body?: string;
  children?: React.ReactNode;
  testID?: string;
}) {
  const { t } = useTranslation();
  const color = tone === 'sage' ? colors.sage : colors.primary;
  return (
    <View style={styles.card} testID={testID}>
      <View style={styles.head}>
        <View style={[styles.iconWrap, { borderColor: color }]}>
          <Ionicons name={icon} size={22} color={color} />
        </View>
        <View style={styles.headText}>
          <AppText variant="micro" color="textTertiary">
            {t('journey.task.eyebrow')}
          </AppText>
          <AppText variant="headline" accessibilityRole="header">
            {title}
          </AppText>
        </View>
      </View>
      {body ? (
        <AppText variant="body" color="textSecondary">
          {body}
        </AppText>
      ) : null}
      {children}
    </View>
  );
}

function CareChecklist({ view, doneCount }: { view: JourneyView; doneCount: number }) {
  const { t } = useTranslation();
  const done = useJourneyLocal((s) => s.care[view.todayIso]) ?? [];
  const toggle = useJourneyLocal((s) => s.toggleCare);
  const complete = doneCount >= CARE_ITEMS.length;
  return (
    <CardShell
      icon={complete ? 'checkmark-circle' : 'heart-outline'}
      tone={complete ? 'sage' : 'copper'}
      title={complete ? t('journey.task.care.doneTitle') : t('journey.task.care.title')}
      body={t('journey.task.care.body')}
      testID="next-task-care"
    >
      <View style={styles.list}>
        {CARE_ITEMS.map((item: CareItem) => {
          const checked = done.includes(item);
          const label = t(`journey.care.items.${item}`);
          return (
            <PressableScale
              key={item}
              onPress={() => toggle(view.todayIso, item)}
              haptic="selection"
              pressedScale={0.985}
              accessibilityRole="checkbox"
              accessibilityLabel={label}
              accessibilityState={{ checked }}
              style={styles.row}
              testID={`care-${item}`}
            >
              <Ionicons
                name={checked ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={checked ? colors.sage : colors.textTertiary}
              />
              <AppText variant="body" color={checked ? 'textSecondary' : 'text'} style={styles.rowText}>
                {label}
              </AppText>
            </PressableScale>
          );
        })}
      </View>
      <AppText variant="caption" color="textTertiary">
        {t('journey.task.care.progress', { done: Math.min(doneCount, CARE_ITEMS.length), total: CARE_ITEMS.length })}
      </AppText>
    </CardShell>
  );
}

/** ONE task for right now: care checklist, photo due, shed nudge, PRP session or "all caught up". */
export function NextTaskCard({ view, index = 0 }: { view: JourneyView; index?: number }) {
  const { t } = useTranslation();
  const startCapture = useStartCapture();
  const careToday = useJourneyLocal((s) => s.care[view.todayIso]);
  const doneCount = careToday?.length ?? 0;

  // Decide once per day whether the checklist still leads, so the card does not swap under a
  // finger the moment the last box is ticked.
  const [careLead, setCareLead] = useState({ date: view.todayIso, pending: doneCount < CARE_ITEMS.length });
  if (careLead.date !== view.todayIso) setCareLead({ date: view.todayIso, pending: doneCount < CARE_ITEMS.length });

  const task = chooseNextTask({
    kind: view.kind,
    goal: view.goal,
    clock: view.clock,
    hasPhotos: view.photos.length > 0,
    lastPhotoDay: view.lastPhotoDay,
    carePending: careLead.pending,
    shedLoggedToday: view.shedLoggedToday,
    prp: view.prp,
  });

  const content = renderTask();
  return content ? <Reveal index={index}>{content}</Reveal> : null;

  function renderTask() {
    switch (task.kind) {
      case 'none':
        return null;
      case 'care':
        return <CareChecklist view={view} doneCount={doneCount} />;
      case 'baseline_photo':
        return (
          <CardShell
            icon="camera-outline"
            title={t('journey.task.baseline.title')}
            body={t('journey.task.baseline.body')}
            testID="next-task-baseline"
          >
            <Button label={t('journey.task.photoCta')} icon="camera" onPress={() => startCapture(task.angle)} />
          </CardShell>
        );
      case 'photo':
        return (
          <CardShell
            icon="camera-outline"
            title={
              task.first
                ? t('journey.task.photo.firstTitle')
                : task.cadence === 'weekly'
                  ? t('journey.task.photo.weeklyTitle')
                  : t('journey.task.photo.monthlyTitle')
            }
            body={task.cadence === 'weekly' ? t('journey.task.photo.weeklyBody') : t('journey.task.photo.monthlyBody')}
            testID="next-task-photo"
          >
            <Button label={t('journey.task.photoCta')} icon="camera" onPress={() => startCapture(task.angle)} />
          </CardShell>
        );
      case 'shed':
        return (
          <CardShell
            icon="water-outline"
            title={t('journey.task.shed.title')}
            body={t('journey.task.shed.body')}
            testID="next-task-shed"
          >
            <Button
              label={t('journey.task.shed.cta')}
              icon="add"
              variant="secondary"
              onPress={() => router.push('/shed')}
            />
          </CardShell>
        );
      case 'prp_due': {
        const prp = view.prp;
        const session = view.prpSessions.find((s) => s.id === task.sessionId);
        const body =
          task.daysOverdue === 0
            ? t('journey.task.prp.bodyToday')
            : t('journey.task.prp.bodyLate', {
                date: session ? formatIsoDate(session.date, currentLocaleTag()) : '',
              });
        return (
          <CardShell
            icon="calendar-outline"
            title={t('journey.task.prp.title', { current: prp?.current ?? 1, total: prp?.total ?? 1 })}
            body={body}
            testID="next-task-prp"
          >
            <View style={styles.actions}>
              <Button
                label={t('journey.task.photoCta')}
                icon="camera"
                size="md"
                onPress={() => startCapture(task.angle)}
                style={styles.action}
              />
              <Button
                label={t('journey.task.prp.markDone')}
                icon="checkmark"
                size="md"
                variant="secondary"
                onPress={() => useJourney.getState().togglePrpSession(task.sessionId)}
                style={styles.action}
              />
            </View>
          </CardShell>
        );
      }
      case 'caught_up': {
        const body =
          task.nextSessionInDays != null
            ? t('journey.task.caughtUp.nextSession', { count: task.nextSessionInDays })
            : task.nextPhotoInDays != null
              ? t('journey.task.caughtUp.nextPhoto', { count: task.nextPhotoInDays })
              : t('journey.task.caughtUp.body');
        return (
          <CardShell
            icon="checkmark-circle-outline"
            tone="sage"
            title={t('journey.task.caughtUp.title')}
            body={body}
            testID="next-task-caught-up"
          />
        );
      }
    }
  }
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
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headText: { flex: 1, gap: 2 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: colors.bgElevated,
  },
  list: { gap: spacing.xs },
  row: {
    minHeight: minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
  },
  rowText: { flex: 1 },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  action: { flexGrow: 1, flexBasis: 140 },
});
