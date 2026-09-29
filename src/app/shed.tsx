/**
 * Shed log (free, spec §4): today's count with quick +10/+25 steps, a 30-day bar chart with
 * the typical shedding window shaded, and the 7-day average. Calm, factual copy only.
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { dayIndex, toIsoDate, weekIndex } from '@shared/timeline';
import { parseShedCount } from '@shared/validation';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { showToast } from '@/components/Toast';
import { Card, CloseButton, EmptyState } from '@/components/ui';
import { useNow } from '@/features/journey/useJourneyView';
import { ShedBars } from '@/features/shed/ShedBars';
import { clampedAdd, recentDays, todayCount, weeklyAverage } from '@/features/shed/shedStats';
import { useFeedback } from '@/hooks/useFeedback';
import { currentLocaleTag } from '@/lib/i18n';
import { formatIsoDate } from '@/lib/phaseView';
import { track } from '@/services/analytics';
import { useJourney } from '@/stores/journey';
import { colors, layout, minTouch, radius, spacing, typography } from '@/theme/tokens';

const QUICK_STEPS = [10, 25] as const;
const CHART_DAYS = 30;

export default function ShedScreen() {
  const { t } = useTranslation();
  const feedback = useFeedback();
  const shed = useJourney((s) => s.shed);
  const procedureDate = useJourney((s) => s.procedureDate);
  const hydrated = useJourney((s) => s.hydrated);
  const now = useNow();
  const today = toIsoDate(now);
  const existing = todayCount(shed, today);

  // `draft` is what the user typed; until they type, the field shows today's stored value
  // (which may arrive after the first render, once the store has hydrated).
  const [draft, setDraft] = useState<string | null>(null);
  const touched = draft !== null;
  const text = draft ?? (existing === null ? '' : String(existing));
  const setText = (value: string) => setDraft(value);

  const parsed = parseShedCount(text);
  const invalid = touched && text.trim() !== '' && parsed === null;
  const day = procedureDate ? dayIndex(procedureDate, now) : null;

  const series = useMemo(() => recentDays(shed, today, CHART_DAYS, procedureDate), [shed, today, procedureDate]);
  const average = weeklyAverage(shed, today);
  const hasEntries = series.some((d) => d.count !== null);
  const locale = currentLocaleTag();

  const chartLabel = useMemo(() => {
    const logged = series
      .filter((d) => d.count !== null)
      .map((d) =>
        t(d.isToday ? 'shed.chart.barToday' : 'shed.chart.bar', {
          date: formatIsoDate(d.date, locale),
          count: d.count ?? 0,
        }),
      );
    return [t('shed.chart.a11y'), ...logged].join('. ');
  }, [series, t, locale]);

  const bump = (delta: number) => {
    setText(String(clampedAdd(parseShedCount(text), delta)));
  };

  const save = () => {
    if (parsed === null) {
      setText(text);
      feedback.warning();
      return;
    }
    useJourney.getState().upsertShed({ date: today, count: parsed });
    track('shed_logged', { count: parsed, day: day ?? -1 });
    feedback.success();
    showToast(t('shed.saved'), 'success');
    setDraft(null);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <View style={styles.top}>
          <AppText variant="title1" accessibilityRole="header" style={styles.flex}>
            {t('shed.title')}
          </AppText>
          <CloseButton onPress={() => router.back()} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <AppText variant="body" color="textSecondary">
            {t('shed.subtitle')}
          </AppText>
          <View style={styles.typical}>
            <AppText variant="callout" color="sage">
              {t('shed.typical')}
            </AppText>
            {day !== null && day >= 0 ? (
              <AppText variant="caption" color="textSecondary">
                {t('shed.phaseNow', { week: weekIndex(day) })}
              </AppText>
            ) : null}
          </View>

          <Card style={styles.entry}>
            <AppText variant="micro" color="textTertiary">
              {t('shed.today')}
            </AppText>
            <AppText variant="headline" nativeID="shed-input-label">
              {t('shed.input.label')}
            </AppText>
            <TextInput
              value={text}
              onChangeText={(value) => setText(value.replace(/[^0-9]/g, '').slice(0, 3))}
              keyboardType="number-pad"
              inputMode="numeric"
              maxLength={3}
              placeholder={t('shed.input.placeholder')}
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel={t('shed.input.label')}
              accessibilityHint={t('shed.input.hint')}
              accessibilityLabelledBy="shed-input-label"
              returnKeyType="done"
              onSubmitEditing={save}
              style={[styles.input, invalid && styles.inputInvalid]}
              testID="shed-input"
            />
            {invalid ? (
              <AppText variant="caption" color="warning" accessibilityRole="alert">
                {t('shed.invalid')}
              </AppText>
            ) : null}
            <View style={styles.quickRow}>
              {QUICK_STEPS.map((step) => (
                <Chip
                  key={step}
                  label={t('shed.quick', { count: step })}
                  selected={false}
                  onPress={() => bump(step)}
                  testID={`shed-quick-${step}`}
                />
              ))}
            </View>
            <Button
              label={existing === null ? t('shed.save') : t('shed.update')}
              onPress={save}
              disabled={parsed === null}
              testID="shed-save"
            />
          </Card>

          <View style={styles.chartBlock}>
            <AppText variant="title2" accessibilityRole="header">
              {t('shed.chart.title')}
            </AppText>
            {!hydrated ? null : hasEntries ? (
              <>
                <ShedBars days={series} height={120} accessibilityLabel={chartLabel} />
                <View style={styles.legend} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                  <View style={styles.legendItem}>
                    <View style={[styles.swatch, { backgroundColor: colors.primary }]} />
                    <AppText variant="caption" color="textSecondary">
                      {t('shed.chart.todayLegend')}
                    </AppText>
                  </View>
                  {procedureDate ? (
                    <View style={styles.legendItem}>
                      <View style={[styles.swatch, styles.windowSwatch]} />
                      <AppText variant="caption" color="textSecondary">
                        {t('shed.chart.window')}
                      </AppText>
                    </View>
                  ) : null}
                  <View style={styles.legendItem}>
                    <View style={styles.dot} />
                    <AppText variant="caption" color="textSecondary">
                      {t('shed.chart.missing')}
                    </AppText>
                  </View>
                </View>
                <AppText variant="bodyStrong">
                  {average === null ? t('shed.averageEmpty') : t('shed.average', { count: average })}
                </AppText>
              </>
            ) : (
              <EmptyState emoji="🌱" title={t('shed.empty.title')} body={t('shed.empty.body')} />
            )}
          </View>

          <AppText variant="caption" color="textTertiary">
            {t('shed.note')}
          </AppText>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgElevated },
  flex: { flex: 1 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.huge,
    gap: spacing.xl,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  typical: { gap: spacing.xs },
  entry: { padding: spacing.lg, gap: spacing.md },
  input: {
    ...typography.title1,
    color: colors.text,
    minHeight: minTouch + 12,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.stroke,
    textAlign: 'auto',
  },
  inputInvalid: { borderColor: colors.warning },
  quickRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chartBlock: { gap: spacing.md },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  windowSwatch: { backgroundColor: colors.sage, opacity: 0.35 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.strokeStrong, marginHorizontal: 3 },
});
