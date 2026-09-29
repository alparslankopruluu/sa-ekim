import { currentLocaleTag } from '@/lib/i18n';

/** Plain, locale-aware date ("Oct 29, 2026"); the only dates the preview screens show. */
export function formatDate(epochMs: number): string {
  try {
    return new Date(epochMs).toLocaleDateString(currentLocaleTag(), { dateStyle: 'medium' });
  } catch {
    return new Date(epochMs).toDateString();
  }
}
