/**
 * Compact recent-shedding bars for the Today card (the card itself is the button; this view
 * is not interactive). Empty state: a single calm line instead of an empty chart.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { toIsoDate } from '@shared/timeline';

import { AppText } from '@/components/AppText';
import { useNow } from '@/features/journey/useJourneyView';
import { useJourney } from '@/stores/journey';
import { spacing } from '@/theme/tokens';

import { ShedBars } from './ShedBars';
import { recentDays } from './shedStats';

export interface ShedMiniChartProps {
  /** Days shown, ending today (default 14). */
  days?: number;
}

const HEIGHT = 44;

export function ShedMiniChart({ days = 14 }: ShedMiniChartProps) {
  const { t } = useTranslation();
  const shed = useJourney((s) => s.shed);
  const procedureDate = useJourney((s) => s.procedureDate);
  const now = useNow();
  const today = toIsoDate(now);
  const span = Math.max(3, Math.min(60, Math.round(days)));

  const series = useMemo(() => recentDays(shed, today, span, procedureDate), [shed, today, span, procedureDate]);
  const hasAny = series.some((d) => d.count !== null);

  if (!hasAny) {
    return (
      <View style={styles.empty} accessible accessibilityLabel={t('shed.mini.a11yEmpty')}>
        <AppText variant="callout" color="textSecondary">
          {t('shed.mini.empty')}
        </AppText>
      </View>
    );
  }

  return <ShedBars days={series} height={HEIGHT} compact accessibilityLabel={t('shed.mini.a11y', { days: span })} />;
}

const styles = StyleSheet.create({
  empty: { minHeight: HEIGHT, justifyContent: 'center', paddingVertical: spacing.xs },
});
