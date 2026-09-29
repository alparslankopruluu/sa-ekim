import * as ImagePicker from 'expo-image-picker';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { showToast } from '@/components/Toast';
import { recordNonFatal } from '@/services/crash';

export interface PickedPhoto {
  uri: string;
  width: number;
  height: number;
}

/** Photo library (system picker — no library permission needed) or camera (permission primed by OS string). */
export function usePhotoPicker() {
  const { t } = useTranslation();

  const pickFromLibrary = useCallback(async (): Promise<PickedPhoto | null> => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        allowsMultipleSelection: false,
        exif: false,
      });
      const asset = result.canceled ? undefined : result.assets[0];
      return asset ? { uri: asset.uri, width: asset.width, height: asset.height } : null;
    } catch (error) {
      recordNonFatal(error, 'pick_photo_library');
      showToast(t('onboarding.photo.permissionDenied'), 'error');
      return null;
    }
  }, [t]);

  const takePhoto = useCallback(async (): Promise<PickedPhoto | null> => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        showToast(t('onboarding.photo.permissionDenied'), 'error');
        return null;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        cameraType: ImagePicker.CameraType.front,
        exif: false,
      });
      const asset = result.canceled ? undefined : result.assets[0];
      return asset ? { uri: asset.uri, width: asset.width, height: asset.height } : null;
    } catch (error) {
      recordNonFatal(error, 'pick_photo_camera');
      return null;
    }
  }, [t]);

  return { pickFromLibrary, takePhoto };
}
