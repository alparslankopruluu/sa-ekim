import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { maturationMonthsFor } from '@shared/catalog';

import { AnimatedNumber } from '@/components/AnimatedNumber';
import { AppText } from '@/components/AppText';
import { ProgressRing } from '@/components/ProgressRing';
import { colors, spacing } from '@/theme/tokens';

import type { JourneyView } from './useJourneyView';

const RING = 188;

/**
 * The day hero: a ring of the maturation window with "Day N · Week W" (transplant), the days
 * left before the operation (planned), or "Session k of n" (PRP course). Days are shown as a
 * plain count, never as a ticking timer.
 */
export function DayHero({ view }: { view: JourneyView }) {
  const { t } = useTranslation();
  const { clock, kind, prp, goal } = view;

  if (kind === 'prp') {
    if (!prp || prp.total === 0) return null;
    const label = prp.allDone
      ? t('journey.hero.prpDone', { total: prp.total })
      : t('journey.hero.prpSession', { current: prp.current, total: prp.total });
    return (
      <View style={styles.wrap} accessible accessibilityRole="summary" accessibilityLabel={label}>
        <ProgressRing progress={prp.total ? prp.done / prp.total : 0} size={RING} stroke={12}>
          <AppText variant="micro" color="textTertiary">
            {t('journey.hero.session')}
          </AppText>
          <AppText variant="display">{String(prp.current)}</AppText>
          <AppText variant="caption" color="textSecondary">
            {t('journey.hero.ofTotal', { total: prp.total })}
          </AppText>
        </ProgressRing>
        <AppText variant="title2" align="center">
          {label}
        </AppText>
      </View>
    );
  }

  if (clock.status === 'upcoming') {
    const label = t('journey.hero.untilOperation', { count: clock.daysUntil });
    return (
      <View style={styles.wrap} accessible accessibilityRole="summary" accessibilityLabel={label}>
        <ProgressRing progress={0} size={RING} stroke={12}>
          <AnimatedNumber value={clock.daysUntil} variant="display" />
          <AppText variant="caption" color="textSecondary">
            {t('journey.hero.daysToGo', { count: clock.daysUntil })}
          </AppText>
        </ProgressRing>
        <AppText variant="title2" align="center">
          {label}
        </AppText>
      </View>
    );
  }

  if (clock.status === 'unset') return null;

  const months = maturationMonthsFor(goal);
  const dayWeek = t('journey.hero.dayWeek', { day: clock.day, week: clock.week });
  const sub =
    clock.status === 'complete'
      ? t('journey.hero.complete', { months })
      : t('journey.hero.monthOf', { month: Math.min(clock.month, months), total: months });

  return (
    <View style={styles.wrap} accessible accessibilityRole="summary" accessibilityLabel={`${dayWeek}. ${sub}`}>
      <ProgressRing progress={clock.progress} size={RING} stroke={12}>
        {clock.status === 'complete' ? <Ionicons name="checkmark-circle" size={30} color={colors.sage} /> : null}
        <AppText variant="micro" color="textTertiary">
          {t('journey.hero.day')}
        </AppText>
        <AnimatedNumber value={clock.day} variant="display" />
      </ProgressRing>
      <View style={styles.text}>
        <AppText variant="title2" align="center">
          {dayWeek}
        </AppText>
        <AppText variant="callout" color="textSecondary" align="center">
          {sub}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.lg },
  text: { alignItems: 'center', gap: spacing.xxs },
});
