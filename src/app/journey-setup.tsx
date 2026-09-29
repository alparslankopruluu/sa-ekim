import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type Goal, GOALS, type JourneyKind } from '@shared/catalog';
import { dayIndex, type IsoDate, toIsoDate, weekIndex } from '@shared/timeline';
import { checkFreeText, MAX_CLINIC_NAME } from '@shared/validation';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { OptionCard } from '@/components/OptionCard';
import { showToast } from '@/components/Toast';
import { CloseButton } from '@/components/ui';
import { DateWheelPicker } from '@/features/journey/DateWheelPicker';
import { rescheduleJourneyReminders } from '@/features/journey/reschedule';
import { addDays, buildPrpSessions, diffDays } from '@/lib/phaseView';
import { track, trackScreen } from '@/services/analytics';
import { useJourney } from '@/stores/journey';
import { useSession } from '@/stores/session';
import { colors, layout, minTouch, radius, spacing, typography } from '@/theme/tokens';

const PAST_DAYS: Record<JourneyKind, number> = { transplant: 3 * 365, prp: 2 * 365 };
const FUTURE_DAYS: Record<JourneyKind, number> = { transplant: 2 * 365, prp: 365 };

const GOAL_ICONS: Record<
  Goal,
  'person-outline' | 'radio-button-on-outline' | 'git-branch-outline' | 'eye-outline' | 'happy-outline'
> = {
  hairline: 'person-outline',
  crown: 'radio-button-on-outline',
  part: 'git-branch-outline',
  brows: 'eye-outline',
  beard: 'happy-outline',
};

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/(tabs)');
}

/** Modal: journey kind, goal (if missing), operation / first-session date and an optional clinic name. */
export default function JourneySetupScreen() {
  const { t } = useTranslation();
  const journey = useJourney();
  const sessionGoal = useSession((s) => s.goal);
  const [today] = useState(() => toIsoDate(new Date()));
  const [kind, setKind] = useState<JourneyKind>(journey.kind);
  const [goal, setGoal] = useState<Goal | null>(sessionGoal);
  const [date, setDate] = useState<IsoDate>(journey.procedureDate ?? today);
  const [clinic, setClinic] = useState(journey.clinicName ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    trackScreen('journey_setup');
  }, []);

  const minDate = addDays(today, -PAST_DAYS[kind]);
  const maxDate = addDays(today, FUTURE_DAYS[kind]);
  const clampedDate = date < minDate ? minDate : date > maxDate ? maxDate : date;

  const clinicVerdict = clinic.trim() ? checkFreeText(clinic, MAX_CLINIC_NAME) : 'ok';
  const clinicError =
    clinicVerdict === 'too_long'
      ? t('journey.setup.clinicTooLong', { max: MAX_CLINIC_NAME })
      : clinicVerdict === 'blocked'
        ? t('journey.setup.clinicBlocked')
        : null;

  const relative = useMemo(() => {
    const day = -diffDays(clampedDate, today);
    if (day === 0) return t('journey.setup.relToday');
    if (day > 0) return t('journey.setup.relPast', { day, week: weekIndex(day) });
    return t('journey.setup.relFuture', { count: -day });
  }, [clampedDate, t, today]);

  const commit = () => {
    const store = useJourney.getState();
    const previousDate = store.procedureDate;
    const chosenGoal = goal ?? sessionGoal ?? 'hairline';
    store.setKind(kind);
    store.setProcedureDate(clampedDate);
    store.setClinicName(clinic.trim() ? clinic.trim() : null);
    if (goal && goal !== sessionGoal) useSession.getState().setGoal(goal);

    // The date now says whether the operation is behind or ahead of the user.
    if (kind === 'transplant')
      useSession.getState().setStage(dayIndex(clampedDate, new Date()) >= 0 ? 'done' : 'planned');

    if (kind === 'prp') {
      const sessions = store.prpSessions;
      const untouched = sessions.every((s) => !s.done);
      if (sessions.length === 0 || (untouched && previousDate !== clampedDate)) {
        store.setPrpSessions(buildPrpSessions(clampedDate, () => Crypto.randomUUID()));
      }
    }

    track('journey_setup', { kind, stage: useSession.getState().stage ?? 'unknown', has_date: true });
    track('day0_set', { goal: chosenGoal, days_from_today: diffDays(today, clampedDate) });
    rescheduleJourneyReminders();
    showToast(t('journey.setup.saved'), 'success');
    close();
  };

  const onSave = () => {
    if (clinicError || saving) return;
    const store = useJourney.getState();
    const relabels = store.procedureDate !== null && store.procedureDate !== clampedDate && store.photos.length > 0;
    if (!relabels) {
      setSaving(true);
      commit();
      return;
    }
    Alert.alert(t('journey.setup.relabelTitle'), t('journey.setup.relabelBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('journey.setup.relabelConfirm'),
        onPress: () => {
          setSaving(true);
          commit();
        },
      },
    ]);
  };

  const needsGoal = sessionGoal === null;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.root}>
      <View style={styles.header}>
        <AppText variant="title1" accessibilityRole="header" style={styles.title}>
          {t('journey.setup.title')}
        </AppText>
        <CloseButton onPress={close} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <AppText variant="headline" accessibilityRole="header">
              {t('journey.setup.kindTitle')}
            </AppText>
            <OptionCard
              title={t('journey.setup.kind.transplant.title')}
              subtitle={t('journey.setup.kind.transplant.body')}
              icon="leaf-outline"
              selected={kind === 'transplant'}
              onPress={() => setKind('transplant')}
              testID="kind-transplant"
            />
            <OptionCard
              title={t('journey.setup.kind.prp.title')}
              subtitle={t('journey.setup.kind.prp.body')}
              icon="water-outline"
              selected={kind === 'prp'}
              onPress={() => setKind('prp')}
              testID="kind-prp"
            />
          </View>

          {needsGoal ? (
            <View style={styles.section}>
              <AppText variant="headline" accessibilityRole="header">
                {t('journey.setup.goalTitle')}
              </AppText>
              {GOALS.map((g) => (
                <OptionCard
                  key={g}
                  title={t(`journey.setup.goals.${g}`)}
                  icon={GOAL_ICONS[g]}
                  selected={goal === g}
                  onPress={() => setGoal(g)}
                  testID={`goal-${g}`}
                />
              ))}
            </View>
          ) : null}

          <View style={styles.section}>
            <AppText variant="headline" accessibilityRole="header">
              {kind === 'prp' ? t('journey.setup.dateTitlePrp') : t('journey.setup.dateTitleTransplant')}
            </AppText>
            <View style={styles.pickerCard}>
              <DateWheelPicker
                value={clampedDate}
                onChange={setDate}
                minDate={minDate}
                maxDate={maxDate}
                fadeColor={colors.surface}
                labels={{ day: t('journey.setup.day'), month: t('journey.setup.month'), year: t('journey.setup.year') }}
              />
              <AppText variant="callout" color="sage" align="center" accessibilityLiveRegion="polite">
                {relative}
              </AppText>
            </View>
          </View>

          <View style={styles.section}>
            <AppText variant="headline" accessibilityRole="header">
              {t('journey.setup.clinicTitle')}
            </AppText>
            <TextInput
              value={clinic}
              onChangeText={setClinic}
              placeholder={t('journey.setup.clinicPlaceholder')}
              placeholderTextColor={colors.textTertiary}
              maxLength={MAX_CLINIC_NAME + 10}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              accessibilityLabel={t('journey.setup.clinicTitle')}
              accessibilityHint={t('journey.setup.clinicHint')}
              style={[styles.input, clinicError ? styles.inputError : null]}
              testID="clinic-input"
            />
            <AppText variant="caption" color={clinicError ? 'danger' : 'textTertiary'} accessibilityLiveRegion="polite">
              {clinicError ?? t('journey.setup.clinicHint')}
            </AppText>
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <Button
            label={t('journey.setup.save')}
            onPress={onSave}
            loading={saving}
            disabled={!!clinicError || (needsGoal && goal === null)}
            shine
            testID="journey-setup-save"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: { flex: 1 },
  scroll: {
    gap: spacing.xxl,
    paddingHorizontal: layout.screenPadding,
    paddingVertical: spacing.lg,
    maxWidth: layout.maxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  section: { gap: spacing.md },
  pickerCard: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke,
  },
  input: {
    ...typography.body,
    minHeight: minTouch + 8,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.stroke,
    color: colors.text,
    textAlign: 'auto',
  },
  inputError: { borderColor: colors.danger },
  footer: { paddingHorizontal: layout.screenPadding, paddingVertical: spacing.md },
});
