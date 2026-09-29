import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { resources } from '@/translations/generated';

import { type AppLanguage, resolveLanguage } from './locales';

export { resources };

export const initialLanguage: AppLanguage = resolveLanguage(getLocales());

if (!i18n.isInitialized) {
  // eslint-disable-next-line import/no-named-as-default-member -- i18next's documented instance API
  void i18n.use(initReactI18next).init({
    resources,
    lng: initialLanguage,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    returnNull: false,
    initAsync: false,
  });
}

export function currentLanguage(): AppLanguage {
  const lang = i18n.language as AppLanguage;
  return lang in resources ? lang : 'en';
}

/** BCP-47 tag for Intl formatting. */
export function currentLocaleTag(): string {
  return currentLanguage();
}

export default i18n;
