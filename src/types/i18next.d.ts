import 'i18next';

import type { EnTranslation } from '@/translations/generated';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: EnTranslation };
    returnNull: false;
  }
}
