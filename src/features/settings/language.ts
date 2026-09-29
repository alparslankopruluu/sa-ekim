/**
 * The user's in-app language choice. Persisted (AsyncStorage) and re-applied at launch;
 * without a choice the app follows the device language (see lib/i18n.ts). Import this module
 * once from the root layout (`import '@/features/settings/language'`) so a stored choice is
 * restored on cold start.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import i18n from '@/lib/i18n';
import { type AppLanguage, SUPPORTED_LANGUAGES } from '@/lib/locales';
import { setUserProperty } from '@/services/analytics';

import { directionChange } from './direction';

export function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

/** Switches i18n and, when the direction flips, flags it for the next launch. */
export async function applyLanguage(language: AppLanguage): Promise<{ needsRestart: boolean }> {
  await i18n.changeLanguage(language);
  const { rtl, needsRestart } = directionChange(language, I18nManager.isRTL);
  if (needsRestart) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(rtl);
  }
  return { needsRestart };
}

interface LanguageState {
  /** The user's explicit choice; null follows the device language. */
  choice: AppLanguage | null;
  choose(language: AppLanguage): Promise<{ needsRestart: boolean }>;
}

export const useLanguagePreference = create<LanguageState>()(
  persist(
    (set) => ({
      choice: null,
      choose: async (language) => {
        set({ choice: language });
        const result = await applyLanguage(language);
        setUserProperty('app_language', language);
        return result;
      },
    }),
    {
      name: 'kok.language.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ choice }) => ({ choice }),
      onRehydrateStorage: () => (state) => {
        if (state?.choice && isAppLanguage(state.choice)) void applyLanguage(state.choice);
      },
    },
  ),
);
