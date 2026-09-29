/**
 * Supported UI languages: the kit's `extended` profile minus da/nb (docs/locales.json), 20 in
 * total. `en` is the schema; `tr` is the second source language. Arabic is right-to-left.
 */
import locales from '@/translations/locales.json';

export const SUPPORTED_LANGUAGES = locales as readonly string[];
export type AppLanguage =
  | 'en'
  | 'tr'
  | 'ar'
  | 'ja'
  | 'zh-Hans'
  | 'ru'
  | 'es'
  | 'pt-BR'
  | 'de'
  | 'fr'
  | 'it'
  | 'ko'
  | 'zh-Hant'
  | 'id'
  | 'vi'
  | 'th'
  | 'hi'
  | 'nl'
  | 'pl'
  | 'sv';

export interface DeviceLocale {
  languageCode?: string | null;
  languageTag?: string | null;
  regionCode?: string | null;
  languageScriptCode?: string | null;
}

const TRADITIONAL_REGIONS = new Set(['TW', 'HK', 'MO']);

/** Maps device locales (in preference order) to the best supported language. */
export function resolveLanguage(locales: readonly DeviceLocale[]): AppLanguage {
  for (const locale of locales) {
    const code = (locale.languageCode ?? locale.languageTag?.split('-')[0] ?? '').toLowerCase();
    if (!code) continue;
    if (code === 'zh') {
      const script = locale.languageScriptCode ?? locale.languageTag?.split('-').find((p) => p.length === 4) ?? '';
      const region = (locale.regionCode ?? locale.languageTag?.split('-').find((p) => p.length === 2 && p !== 'zh') ?? '').toUpperCase();
      return script === 'Hant' || TRADITIONAL_REGIONS.has(region) ? 'zh-Hant' : 'zh-Hans';
    }
    if (code === 'pt') return 'pt-BR';
    if (code === 'nb' || code === 'nn' || code === 'no' || code === 'da') return 'sv';
    if (code === 'in') return 'id'; // legacy Android code for Indonesian
    const direct = SUPPORTED_LANGUAGES.find((lang) => lang.toLowerCase() === code);
    if (direct) return direct as AppLanguage;
  }
  return 'en';
}

export function isRtl(language: AppLanguage): boolean {
  return language === 'ar';
}

/** Native name shown in the language picker (never translated, so users can always find theirs). */
export const LANGUAGE_NAMES: Record<AppLanguage, string> = {
  en: 'English',
  tr: 'Türkçe',
  ar: 'العربية',
  ja: '日本語',
  'zh-Hans': '简体中文',
  ru: 'Русский',
  es: 'Español',
  'pt-BR': 'Português (Brasil)',
  de: 'Deutsch',
  fr: 'Français',
  it: 'Italiano',
  ko: '한국어',
  'zh-Hant': '繁體中文',
  id: 'Bahasa Indonesia',
  vi: 'Tiếng Việt',
  th: 'ไทย',
  hi: 'हिन्दी',
  nl: 'Nederlands',
  pl: 'Polski',
  sv: 'Svenska',
};
