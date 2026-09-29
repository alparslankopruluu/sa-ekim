import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import type { PreviewDoc } from '@shared/api';

import { showToast } from '@/components/Toast';
import { useErrorMessage } from '@/lib/errors';
import { deletePreview } from '@/services/generation';

import { forgetMediaUrl } from './useMediaUrl';

/** Confirm → delete → toast. `onDeleted` runs after the server removed the preview. */
export function useDeletePreview() {
  const { t } = useTranslation();
  const message = useErrorMessage();
  const [busyId, setBusyId] = useState<string | null>(null);

  const confirmDelete = useCallback(
    (doc: Pick<PreviewDoc, 'id' | 'resultPath'>, onDeleted?: () => void) => {
      Alert.alert(t('preview.delete.title'), t('preview.delete.body'), [
        { text: t('preview.common.cancel'), style: 'cancel' },
        {
          text: t('preview.common.delete'),
          style: 'destructive',
          onPress: () => {
            setBusyId(doc.id);
            deletePreview(doc.id)
              .then(() => {
                forgetMediaUrl(doc.resultPath);
                showToast(t('preview.delete.done'), 'success');
                onDeleted?.();
              })
              .catch((error: unknown) => showToast(message(error), 'error'))
              .finally(() => setBusyId(null));
          },
        },
      ]);
    },
    [message, t],
  );

  return { confirmDelete, busyId };
}
