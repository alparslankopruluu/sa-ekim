import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import type { IsoDate } from '@shared/timeline';

import { type WeekLabel, weekLabelFor } from './compareLogic';

/** Translated "Before" / "Week N" for a photo timestamp. */
export function useWeekLabel(procedureDate: IsoDate | null): (takenAt: number) => string {
  const { t } = useTranslation();
  return useCallback(
    (takenAt: number) => {
      const label: WeekLabel = weekLabelFor(takenAt, procedureDate);
      if (label.kind === 'before') return t('compare.label.before');
      if (label.kind === 'week') return t('compare.label.week', { n: label.week });
      return t('compare.label.none');
    },
    [t, procedureDate],
  );
}

/** Localized calendar date of a timestamp. */
export function formatTakenAt(takenAt: number, locale: string): string {
  try {
    return new Date(takenAt).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return new Date(takenAt).toDateString();
  }
}
