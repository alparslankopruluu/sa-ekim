import * as Crypto from 'expo-crypto';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { ANGLES_BY_GOAL } from '@shared/catalog';
import { PRP_DEFAULTS } from '@shared/timeline';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { currentLocaleTag } from '@/lib/i18n';
import { addDays, buildPrpSessions, formatIsoDate, maintenanceDate } from '@/lib/phaseView';
import { useJourney } from '@/stores/journey';
import { colors, radius, spacing } from '@/theme/tokens';

import { useStartCapture } from './access';
import { SetDateCard } from './PreJourneyCard';
import { rescheduleJourneyReminders } from './reschedule';
import { SessionsList } from './SessionsList';
import type { JourneyView } from './useJourneyView';

const MAX_SESSIONS = 12;

/** PRP / mesotherapy course planner: default 3 sessions 4 weeks apart, all editable, plus the maintenance note. */
export function PrpPlanner({ view }: { view: JourneyView }) {
  const { t } = useTranslation();
  const startCapture = useStartCapture();
  const [editingId, setEditingId] = useState<string | null>(null);
  const locale = currentLocaleTag();
  const { prpSessions: stored, procedureDate, todayIso, goal } = view;
  const sessions = useMemo(() => [...stored].sort((a, b) => a.date.localeCompare(b.date)), [stored]);
  const maintenance = maintenanceDate(sessions, PRP_DEFAULTS.maintenanceMonths);
  const angle = ANGLES_BY_GOAL[goal][0] ?? 'front';

  const commit = useCallback((next: typeof stored) => {
    useJourney.getState().setPrpSessions(next);
  }, []);

  const createPlan = useCallback(() => {
    if (!procedureDate) return;
    commit(buildPrpSessions(procedureDate, () => Crypto.randomUUID()));
    rescheduleJourneyReminders();
  }, [commit, procedureDate]);

  const addSession = useCallback(() => {
    const last = sessions.at(-1);
    const base = last?.date ?? procedureDate ?? todayIso;
    const date = last ? addDays(base, PRP_DEFAULTS.intervalWeeks * 7) : base;
    commit([...sessions, { id: Crypto.randomUUID(), date, done: false }]);
    rescheduleJourneyReminders();
  }, [commit, procedureDate, sessions, todayIso]);

  const removeSession = useCallback(
    (id: string) => {
      Alert.alert(t('journey.prp.removeTitle'), t('journey.prp.removeBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('journey.prp.remove'),
          style: 'destructive',
          onPress: () => {
            commit(sessions.filter((s) => s.id !== id));
            setEditingId(null);
            rescheduleJourneyReminders();
          },
        },
      ]);
    },
    [commit, sessions, t],
  );

  if (!procedureDate) return <SetDateCard kind="prp" />;

  if (sessions.length === 0) {
    return (
      <View style={styles.card}>
        <AppText variant="title2" accessibilityRole="header">
          {t('journey.prp.emptyTitle')}
        </AppText>
        <AppText variant="body" color="textSecondary">
          {t('journey.prp.emptyBody', { sessions: PRP_DEFAULTS.sessions, weeks: PRP_DEFAULTS.intervalWeeks })}
        </AppText>
        <Button label={t('journey.prp.createPlan')} icon="add" onPress={createPlan} testID="prp-create" />
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <AppText variant="body" color="textSecondary">
        {t('journey.prp.intro')}
      </AppText>
      <SessionsList
        sessions={sessions}
        today={todayIso}
        editingId={editingId}
        canRemove={sessions.length > 1}
        onToggle={(id) => {
          useJourney.getState().togglePrpSession(id);
          rescheduleJourneyReminders();
        }}
        onEdit={(id) => {
          setEditingId(id);
          if (id === null) rescheduleJourneyReminders();
        }}
        onDateChange={(id, date) => commit(sessions.map((s) => (s.id === id ? { ...s, date } : s)))}
        onPhoto={() => startCapture(angle)}
        onRemove={removeSession}
      />
      {sessions.length < MAX_SESSIONS ? (
        <Button
          label={t('journey.prp.addSession')}
          icon="add"
          variant="secondary"
          size="md"
          onPress={addSession}
          testID="prp-add"
        />
      ) : null}
      {maintenance ? (
        <View style={styles.card}>
          <AppText variant="headline">{t('journey.prp.maintenanceTitle')}</AppText>
          <AppText variant="body" color="textSecondary">
            {t('journey.prp.maintenanceBody', {
              months: PRP_DEFAULTS.maintenanceMonths,
              date: formatIsoDate(maintenance, locale, 'long'),
            })}
          </AppText>
          <AppText variant="caption" color="textTertiary">
            {t('journey.prp.clinicNote')}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.lg },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke,
  },
});
