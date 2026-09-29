import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import type { PhaseId } from '@shared/timeline';
import { weekIndex } from '@shared/timeline';

import { AppText } from '@/components/AppText';
import { PressableScale } from '@/components/PressableScale';
import { formatIsoDate, type PhaseRow } from '@/lib/phaseView';
import { colors, glows, radius, spacing } from '@/theme/tokens';

import { Chevron } from './Chevron';
import { Tag } from './Tag';

export interface PhaseRailProps {
  rows: readonly PhaseRow[];
  currentId: PhaseId | null;
  /** Day index now; phases that ended before it are drawn as completed. */
  day: number | null;
  locale: string;
  /** Free users see a small lock on guides that are Pro (titles and dates stay visible). */
  showLocks: boolean;
}

const MARKER = 22;

/** Vertical timeline of every phase with dates, the current one highlighted. Tap → phase guide. */
export function PhaseRail({ rows, currentId, day, locale, showLocks }: PhaseRailProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.rail}>
      {rows.map((row, i) => {
        const current = row.id === currentId;
        const past = day !== null && day > row.toDay;
        const last = i === rows.length - 1;
        const title = t(`guide.${row.id}.title`);
        const dates =
          row.startDate && row.endDate
            ? t('journey.rail.dates', {
                from: formatIsoDate(row.startDate, locale),
                to: formatIsoDate(row.endDate, locale),
              })
            : t('journey.rail.days', { from: row.fromDay, to: row.toDay });
        const weeks = t('journey.rail.weeks', { from: weekIndex(row.fromDay), to: weekIndex(row.toDay) });
        const state = current ? t('journey.rail.current') : past ? t('journey.rail.past') : t('journey.rail.upcoming');
        return (
          <View key={row.id} style={styles.item}>
            <View style={styles.markerCol}>
              <View
                style={[
                  styles.dot,
                  past && styles.dotPast,
                  current && styles.dotCurrent,
                  current && { boxShadow: glows.primary },
                ]}
              >
                {past ? <Ionicons name="checkmark" size={13} color={colors.textOnAccent} /> : null}
              </View>
              {!last ? <View style={[styles.line, past && styles.linePast]} /> : null}
            </View>
            <PressableScale
              onPress={() => router.push({ pathname: '/guide/[phase]', params: { phase: row.id } })}
              pressedScale={0.985}
              accessibilityLabel={`${title}. ${dates}. ${state}.${row.anxious ? ` ${t('journey.phase.expected')}.` : ''}`}
              accessibilityHint={t('journey.phase.openGuide')}
              style={[styles.card, current && styles.cardCurrent]}
              testID={`rail-${row.id}`}
            >
              <View style={styles.cardHead}>
                <View style={styles.cardTitle}>
                  {current ? (
                    <AppText variant="micro" color="primary">
                      {t('journey.rail.youAreHere')}
                    </AppText>
                  ) : null}
                  <AppText variant="headline" color={past ? 'textSecondary' : 'text'}>
                    {title}
                  </AppText>
                </View>
                {showLocks && row.id !== 'care' ? (
                  <Ionicons name="lock-closed-outline" size={16} color={colors.textTertiary} />
                ) : null}
                <Chevron />
              </View>
              <AppText variant="callout" color="textSecondary">
                {dates}
              </AppText>
              <View style={styles.meta}>
                <AppText variant="caption" color="textTertiary">
                  {weeks}
                </AppText>
                {row.anxious ? <Tag label={t('journey.phase.expected')} /> : null}
              </View>
            </PressableScale>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { gap: 0 },
  item: { flexDirection: 'row', gap: spacing.md },
  markerCol: { width: MARKER, alignItems: 'center' },
  dot: {
    width: MARKER - 4,
    height: MARKER - 4,
    marginTop: spacing.lg,
    borderRadius: MARKER,
    borderWidth: 2,
    borderColor: colors.strokeStrong,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotPast: { backgroundColor: colors.sage, borderColor: colors.sage },
  dotCurrent: { borderColor: colors.primary, backgroundColor: colors.primary },
  line: { flex: 1, width: 2, marginTop: spacing.xs, backgroundColor: colors.stroke },
  linePast: { backgroundColor: colors.sageDeep },
  card: {
    flex: 1,
    gap: spacing.xs,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke,
  },
  cardCurrent: { borderColor: colors.primary, borderWidth: 1 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { flex: 1, gap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
});
