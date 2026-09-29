import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { Stage } from '@shared/catalog';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { track } from '@/services/analytics';
import { useJourney } from '@/stores/journey';
import { useSession } from '@/stores/session';
import { colors, radius, spacing } from '@/theme/tokens';

import { DateWheel, type WheelItem } from './DateWheel';
import { useEntering } from './motion';
import {
  type DateField,
  type DateParts,
  type DateStage,
  checkProcedureDate,
  clampParts,
  dateFieldOrder,
  daysInMonth,
  describeDay,
  initialParts,
  isoToParts,
  monthLabel,
  numberLabel,
  yearRange,
} from './procedureDate';
import { StepScaffold } from './StepScaffold';

const ERROR_KEYS = {
  invalid: 'onboarding.date.errorInvalid',
  must_be_past: 'onboarding.date.errorMustBePast',
  must_be_future: 'onboarding.date.errorMustBeFuture',
  too_far: 'onboarding.date.errorTooFar',
} as const;

function asDateStage(stage: Stage | null): DateStage {
  return stage === 'done' ? 'done' : 'planned';
}

/** Operation date: three wheels, live "Day N · Week W" / "In N days" feedback, skippable. */
export function DateStep({ onNext }: { onNext: () => void }) {
  const { t, i18n } = useTranslation();
  const stageValue = useSession((s) => s.stage);
  const goal = useSession((s) => s.goal);
  const stage = asDateStage(stageValue);
  const [now] = useState(() => new Date());
  const locale = i18n.language;
  const stored = useJourney((s) => s.procedureDate);
  const [parts, setParts] = useState<DateParts>(() => (stored ? (isoToParts(stored) ?? initialParts(now)) : initialParts(now)));

  const header = useEntering('up');
  const wheels = useEntering('up', 120);

  const check = checkProcedureDate(parts, stage, now);
  const order = useMemo(() => dateFieldOrder(locale), [locale]);

  const items = (() => {
    const days: WheelItem[] = Array.from({ length: daysInMonth(parts.year, parts.month) }, (_, i) => ({
      value: i + 1,
      label: numberLabel(locale, i + 1),
    }));
    const months: WheelItem[] = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: monthLabel(locale, i + 1) }));
    const years: WheelItem[] = yearRange(stage, now).map((year) => ({ value: year, label: numberLabel(locale, year) }));
    return { day: days, month: months, year: years } satisfies Record<DateField, WheelItem[]>;
  })();

  const labels: Record<DateField, string> = {
    day: t('onboarding.date.wheelDay'),
    month: t('onboarding.date.wheelMonth'),
    year: t('onboarding.date.wheelYear'),
  };

  const setField = (field: DateField, value: number) => setParts((p) => clampParts({ ...p, [field]: value }));

  const feedback = (() => {
    if (!check.ok) return { text: t(ERROR_KEYS[check.reason]), tone: 'danger' as const };
    const described = describeDay(check.dayIndex);
    if (described.kind === 'future') return { text: t('onboarding.date.feedbackFuture', { count: described.days }), tone: 'sage' as const };
    if (described.kind === 'today') return { text: t('onboarding.date.feedbackToday'), tone: 'sage' as const };
    return { text: t('onboarding.date.feedbackPast', { day: described.day, week: described.week }), tone: 'sage' as const };
  })();

  const confirm = () => {
    if (!check.ok) return;
    useJourney.getState().setProcedureDate(check.iso);
    track('day0_set', { goal: goal ?? 'none', days_from_today: -check.dayIndex });
    onNext();
  };

  const skip = () => {
    useJourney.getState().setProcedureDate(null);
    onNext();
  };

  return (
    <StepScaffold
      contentStyle={styles.content}
      footer={
        <>
          <Button label={t('common.continue')} onPress={confirm} disabled={!check.ok} shine={check.ok} testID="date-continue" />
          <Button label={t('onboarding.date.skip')} onPress={skip} variant="ghost" size="md" testID="date-skip" />
          <AppText variant="caption" color="textTertiary" align="center">
            {t('onboarding.date.skipNote')}
          </AppText>
        </>
      }
    >
      <Animated.View entering={header} style={styles.header}>
        <AppText variant="title1" accessibilityRole="header">
          {stage === 'done' ? t('onboarding.date.titleDone') : t('onboarding.date.titlePlanned')}
        </AppText>
        <AppText variant="body" color="textSecondary">
          {stage === 'done' ? t('onboarding.date.subtitleDone') : t('onboarding.date.subtitlePlanned')}
        </AppText>
      </Animated.View>

      <Animated.View entering={wheels} style={styles.picker}>
        <View style={styles.wheels}>
          {order.map((field) => (
            <DateWheel
              key={field}
              items={items[field]}
              value={parts[field]}
              onChange={(value) => setField(field, value)}
              label={labels[field]}
              testID={`date-wheel-${field}`}
            />
          ))}
        </View>
        <View
          style={[styles.feedback, !check.ok && styles.feedbackError]}
          accessibilityRole={check.ok ? 'text' : 'alert'}
          accessibilityLiveRegion="polite"
          testID="date-feedback"
        >
          <AppText variant="headline" color={feedback.tone === 'danger' ? 'danger' : 'sage'} align="center">
            {feedback.text}
          </AppText>
        </View>
      </Animated.View>
    </StepScaffold>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl },
  header: { gap: spacing.sm, marginTop: spacing.md },
  picker: { gap: spacing.lg },
  wheels: { flexDirection: 'row', gap: spacing.sm },
  feedback: {
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke,
  },
  feedbackError: { borderColor: colors.danger },
});
