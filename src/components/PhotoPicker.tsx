import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { usePhotoPicker } from '@/hooks/usePhotoPicker';
import type { PhotoDraft } from '@/stores/previewDraft';
import { colors, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Button } from './Button';

export interface PhotoPickerProps {
  photo: PhotoDraft | null;
  /** Called with a library photo (no region hint: the gallery has no capture guide). */
  onChange: (photo: PhotoDraft) => void;
  /** Opens the guided camera (the caller owns navigation to the capture screen). */
  onCamera: () => void;
  /** Width of the preview frame; the height follows a 4:5 portrait ratio. */
  previewSize: number;
  /** Short, honest guidance lines shown under the frame. */
  tips?: readonly string[];
}

/** Photo intake for a preview: frame, guidance, take-photo and choose-from-library. */
export function PhotoPicker({ photo, onChange, onCamera, previewSize, tips = [] }: PhotoPickerProps) {
  const { t } = useTranslation();
  const { pickFromLibrary } = usePhotoPicker();

  const fromLibrary = async () => {
    const picked = await pickFromLibrary();
    if (!picked) return;
    onChange({ localUri: picked.uri, storagePath: null, source: 'library' });
  };

  return (
    <View style={styles.container}>
      <View style={styles.preview}>
        <View
          style={[styles.frame, !photo && styles.frameEmpty, { width: previewSize, height: previewSize * 1.25 }]}
          accessible
          accessibilityRole="image"
          accessibilityLabel={photo ? t('onboarding.photo.selected') : t('onboarding.photo.placeholder')}
        >
          {photo ? (
            <Animated.View entering={FadeIn.duration(200)} style={StyleSheet.absoluteFill} key={photo.localUri}>
              <Image source={{ uri: photo.localUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            </Animated.View>
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="person-outline" size={previewSize * 0.34} color={colors.textTertiary} />
              <AppText variant="caption" color="textTertiary" align="center">
                {t('onboarding.photo.placeholder')}
              </AppText>
            </View>
          )}
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          label={photo ? t('onboarding.photo.change') : t('onboarding.photo.take')}
          icon="camera-outline"
          onPress={onCamera}
          variant={photo ? 'secondary' : 'primary'}
          size="md"
          testID="photo-camera"
        />
        <Button
          label={t('onboarding.photo.library')}
          icon="images-outline"
          onPress={() => void fromLibrary()}
          variant="secondary"
          size="md"
          testID="photo-library"
        />
      </View>

      {tips.length > 0 ? (
        <View style={styles.tips}>
          <AppText variant="caption" color="textSecondary" accessibilityRole="header">
            {t('onboarding.photo.guidanceTitle')}
          </AppText>
          {tips.map((tip) => (
            <View key={tip} style={styles.tip}>
              <Ionicons name="checkmark-circle" size={16} color={colors.sage} style={styles.tipIcon} />
              <AppText variant="caption" color="textSecondary" style={styles.tipText}>
                {tip}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}

      <AppText variant="caption" color="textTertiary">
        {t('onboarding.photo.privacy')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  preview: { alignItems: 'center', paddingVertical: spacing.xs },
  frame: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.strokeStrong,
  },
  frameEmpty: { borderStyle: 'dashed' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg },
  actions: { gap: spacing.sm },
  tips: { gap: spacing.xs },
  tip: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  tipIcon: { marginTop: 1 },
  tipText: { flex: 1 },
});
