import * as ImagePicker from 'expo-image-picker';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { showToast } from '@/components/Toast';
import { recordNonFatal } from '@/services/crash';
import { track } from '@/services/analytics';
import { usePreviewDraft } from '@/stores/previewDraft';

/** System photo picker (no library permission needed) → the preview draft. */
export function useLibraryPhoto(): () => Promise<void> {
  const { t } = useTranslation();
  return useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        allowsMultipleSelection: false,
        exif: false,
      });
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset) return;
      usePreviewDraft.getState().setPhoto({ localUri: asset.uri, storagePath: null, source: 'library' });
      track('photo_selected', { source: 'library' });
    } catch (error) {
      recordNonFatal(error, 'preview_pick_library');
      showToast(t('preview.photo.libraryFailed'), 'error');
    }
  }, [t]);
}
