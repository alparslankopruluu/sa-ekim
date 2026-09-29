/**
 * "People in your week" (spec §4). Pro-only and opt-in: joining sends only the operation
 * date, goal and journey kind. The count appears only at or above the privacy threshold
 * (remote `cohort_min_visible`, never below COHORT_MIN_VISIBLE); otherwise the card shows an
 * invitation without any number. Free users see a locked teaser that opens the paywall.
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Switch, View } from 'react-native';

import type { CohortStats } from '@shared/api';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Card } from '@/components/ui';
import { openPaywall } from '@/features/journey/access';
import { useEntitlement } from '@/lib/entitlements';
import { errorCodeOf } from '@/lib/errors';
import { track } from '@/services/analytics';
import { recordNonFatal } from '@/services/crash';
import { getCohort, joinCohort } from '@/services/generation';
import { remoteNumber } from '@/services/remoteConfig';
import { useJourney } from '@/stores/journey';
import { useSession } from '@/stores/session';
import { colors, spacing } from '@/theme/tokens';

import { cohortDisplay, effectiveMinVisible, type JoinErrorKind, joinErrorKind } from './cohortLogic';

type Status = 'idle' | 'joining' | 'loading' | 'ready' | 'error';

function minVisible(): number {
  try {
    return effectiveMinVisible(remoteNumber('cohort_min_visible'));
  } catch {
    return effectiveMinVisible(undefined);
  }
}

export default function CohortCard() {
  const { t } = useTranslation();
  const { canUse, loaded } = useEntitlement();
  const gate = canUse('cohort');
  const joined = useJourney((s) => s.cohortJoined);
  const procedureDate = useJourney((s) => s.procedureDate);
  const kind = useJourney((s) => s.kind);
  const goal = useSession((s) => s.goal) ?? 'hairline';

  const [status, setStatus] = useState<Status>('idle');
  const [stats, setStats] = useState<CohortStats | null>(null);
  const [error, setError] = useState<JoinErrorKind | null>(null);
  const viewed = useRef(false);

  const requested = useRef(false);

  /** Fetches the counts; state is only set after the answer arrives. */
  const fetchStats = useCallback(async () => {
    try {
      const next = await getCohort();
      setStats(next);
      setError(null);
      setStatus('ready');
      if (!viewed.current) {
        viewed.current = true;
        track('cohort_view', { visible: cohortDisplay(next, minVisible()).visible });
      }
    } catch (e) {
      setError(joinErrorKind(errorCodeOf(e)));
      setStatus('error');
    }
  }, []);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    await fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (!gate.allowed || !joined || requested.current) return;
    requested.current = true;
    void fetchStats();
  }, [gate.allowed, joined, fetchStats]);

  const join = async () => {
    if (!procedureDate) return;
    setStatus('joining');
    setError(null);
    try {
      await joinCohort({ procedureDate, goal, kind });
      requested.current = true;
      useJourney.getState().setCohortJoined(true);
      track('cohort_joined', { goal });
      await load();
    } catch (e) {
      recordNonFatal(e, 'cohort_join');
      setError(joinErrorKind(errorCodeOf(e)));
      setStatus('error');
    }
  };

  const onToggle = (value: boolean) => {
    if (value) {
      void join();
      return;
    }
    // Local opt-out: the card stops asking. The server keeps only the anonymous count.
    useJourney.getState().setCohortJoined(false);
    requested.current = false;
    setStats(null);
    setStatus('idle');
  };

  if (!loaded) return null;

  if (!gate.allowed) {
    return (
      <Card style={styles.card}>
        <View style={styles.head}>
          <Ionicons name="people-outline" size={20} color={colors.accent} />
          <AppText variant="headline" style={styles.flex}>
            {t('cohort.locked.title')}
          </AppText>
          <Ionicons name="lock-closed" size={16} color={colors.textTertiary} />
        </View>
        <AppText variant="body" color="textSecondary">
          {t('cohort.locked.body')}
        </AppText>
        <Button
          label={t('cohort.locked.cta')}
          variant="secondary"
          size="md"
          onPress={() => openPaywall(gate.paywallSource ?? 'home_banner', 'cohort')}
          testID="cohort-locked-cta"
        />
      </Card>
    );
  }

  const display = cohortDisplay(stats, minVisible());
  const busy = status === 'joining' || status === 'loading';

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Ionicons name="people-outline" size={20} color={colors.sage} />
        <AppText variant="headline" style={styles.flex} accessibilityRole="header">
          {joined ? t('cohort.title') : t('cohort.join.title')}
        </AppText>
      </View>

      {!joined ? (
        <>
          <AppText variant="body" color="textSecondary">
            {t('cohort.join.body')}
          </AppText>
          {procedureDate ? (
            <View style={styles.switchRow}>
              <AppText variant="bodyStrong" style={styles.flex}>
                {status === 'joining' ? t('cohort.joining') : t('cohort.join.switch')}
              </AppText>
              {status === 'joining' ? <ActivityIndicator color={colors.primary} /> : null}
              <Switch
                value={status === 'joining'}
                onValueChange={onToggle}
                disabled={busy}
                trackColor={{ true: colors.sageDeep, false: colors.surfacePressed }}
                accessibilityLabel={t('cohort.join.switch')}
                accessibilityState={{ busy, disabled: busy }}
                testID="cohort-switch"
              />
            </View>
          ) : (
            <View style={styles.switchRow}>
              <AppText variant="callout" color="textTertiary" style={styles.flex}>
                {t('cohort.join.needDate')}
              </AppText>
              <Button
                label={t('cohort.join.setDate')}
                variant="ghost"
                size="sm"
                onPress={() => router.push('/journey-setup')}
              />
            </View>
          )}
        </>
      ) : (
        <>
          {status === 'loading' || status === 'idle' ? (
            <View style={styles.switchRow} accessibilityLiveRegion="polite">
              <ActivityIndicator color={colors.sage} />
              <AppText variant="callout" color="textSecondary">
                {t('cohort.loading')}
              </AppText>
            </View>
          ) : status === 'ready' ? (
            display.visible ? (
              <AppText variant="title2" accessibilityLiveRegion="polite">
                {t('cohort.visible', { count: display.count })}
              </AppText>
            ) : (
              <AppText variant="body" color="textSecondary" accessibilityLiveRegion="polite">
                {t('cohort.invitation')}
              </AppText>
            )
          ) : null}
          <View style={styles.switchRow}>
            <AppText variant="caption" color="textTertiary" style={styles.flex}>
              {t('cohort.privacy')}
            </AppText>
            <Switch
              value
              onValueChange={onToggle}
              disabled={busy}
              trackColor={{ true: colors.sageDeep, false: colors.surfacePressed }}
              accessibilityLabel={t('cohort.joined')}
              testID="cohort-switch"
            />
          </View>
        </>
      )}

      {status === 'error' && error ? (
        <View style={styles.switchRow} accessibilityRole="alert">
          <AppText variant="callout" color="warning" style={styles.flex}>
            {t(`cohort.error.${error}`)}
          </AppText>
          {error !== 'pro' ? (
            <Button
              label={t('cohort.error.retry')}
              variant="ghost"
              size="sm"
              icon="refresh"
              onPress={() => void (joined ? load() : join())}
            />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
});
