import { type AppLanguage, isRtl } from '@/lib/locales';

/**
 * Whether switching to `language` flips the layout direction. React Native only re-reads
 * the direction at launch, so a flip needs a restart (Settings shows a note).
 */
export function directionChange(
  language: AppLanguage,
  currentlyRtl: boolean,
): { rtl: boolean; needsRestart: boolean } {
  const rtl = isRtl(language);
  return { rtl, needsRestart: rtl !== currentlyRtl };
}
