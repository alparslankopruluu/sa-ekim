import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import type { SubjectKind } from '@shared/catalog';

import { SAMPLE_PHOTOS, SAMPLE_SUBJECT, type SampleId, sampleLocalUri } from '@/features/demo/samples';
import { usePhotoPicker } from '@/hooks/usePhotoPicker';
import { track } from '@/services/analytics';
import type { PhotoDraft } from '@/stores/draft';
import { colors, minTouch, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Button } from './Button';
import { Chip } from './Chip';
import { PressableScale } from './PressableScale';
import { StickerPhoto } from './StickerPhoto';

const SUBJECTS: readonly SubjectKind[] = ['person', 'pet', 'drawing'];
const SAMPLE_IDS: readonly SampleId[] = ['nova', 'rex', 'mochi'];
const TIPS = ['tip1', 'tip2', 'tip3'] as const;

export interface PhotoPickerProps {
  photo: PhotoDraft | null;
  onChange: (photo: PhotoDraft) => void;
  previewSize: number;
  palette?: 'magenta' | 'violet' | 'lime' | 'gold' | 'rose';
}

/** Photo intake shared by onboarding and the create wizard. */
export function PhotoPicker({ photo, onChange, previewSize, palette = 'magenta' }: PhotoPickerProps) {
  const { t } = useTranslation();
  const { pickFromLibrary, takePhoto } = usePhotoPicker();

  const fromDevice = async (source: 'library' | 'camera') => {
    const picked = source === 'library' ? await pickFromLibrary() : await takePhoto();
    if (!picked) return;
    const subject = photo?.source !== 'sample' && photo?.subject ? photo.subject : 'person';
    onChange({ localUri: picked.uri, storagePath: null, subject, source });
    track('photo_selected', { source, subject });
  };

  const fromSample = async (id: SampleId) => {
    const uri = await sampleLocalUri(id);
    onChange({ localUri: uri, storagePath: null, subject: SAMPLE_SUBJECT[id], source: 'sample', sampleId: id });
    track('photo_selected', { source: 'sample', subject: SAMPLE_SUBJECT[id] });
  };

  return (
    <View style={styles.container}>
      <View style={styles.preview}>
        <StickerPhoto
          uri={photo?.localUri ?? null}
          palette={palette}
          size={previewSize}
          wiggleKey={photo?.localUri}
          accessibilityLabel={photo ? t('onboarding.photo.change') : t('onboarding.photo.title')}
        >
          {!photo ? (
            <View style={styles.placeholder}>
              <Ionicons name="person-circle-outline" size={previewSize * 0.4} color={colors.textSecondary} />
            </View>
          ) : null}
        </StickerPhoto>
      </View>

      <View style={styles.actions}>
        <Button
          label={t('onboarding.photo.library')}
          icon="images-outline"
          onPress={() => void fromDevice('library')}
          variant={photo ? 'secondary' : 'primary'}
          testID="photo-library"
        />
        <Button
          label={t('onboarding.photo.camera')}
          icon="camera-outline"
          onPress={() => void fromDevice('camera')}
          variant="secondary"
          size="md"
          testID="photo-camera"
        />
      </View>

      <View style={styles.samples}>
        <AppText variant="caption" color="textSecondary">
          {t('onboarding.photo.sample')}
        </AppText>
        <View style={styles.sampleRow}>
          {SAMPLE_IDS.map((id, index) => {
            const selected = photo?.sampleId === id;
            return (
              <Animated.View key={id} entering={FadeInDown.delay(index * 60)}>
                <PressableScale
                  onPress={() => void fromSample(id)}
                  haptic="selection"
                  accessibilityLabel={t('a11y.character', { name: t(`onboarding.demo.characters.${id}`) })}
                  accessibilityState={{ selected }}
                  style={[styles.sample, selected && styles.sampleSelected]}
                  testID={`sample-${id}`}
                >
                  <Image source={SAMPLE_PHOTOS[id]} style={styles.sampleImage} contentFit="cover" />
                </PressableScale>
              </Animated.View>
            );
          })}
        </View>
      </View>

      {photo ? (
        <Animated.View entering={FadeIn} style={styles.subjects}>
          <AppText variant="caption" color="textSecondary">
            {t('onboarding.photo.subjectTitle')}
          </AppText>
          <View style={styles.subjectRow}>
            {SUBJECTS.map((subject) => (
              <Chip
                key={subject}
                label={t(`subjects.${subject}`)}
                selected={photo.subject === subject}
                onPress={() => onChange({ ...photo, subject })}
                testID={`subject-${subject}`}
              />
            ))}
          </View>
        </Animated.View>
      ) : (
        <View style={styles.tips}>
          {TIPS.map((tip) => (
            <View key={tip} style={styles.tip}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <AppText variant="caption" color="textSecondary">
                {t(`onboarding.photo.${tip}`)}
              </AppText>
            </View>
          ))}
        </View>
      )}

      <AppText variant="caption" color="textTertiary">
        {t('onboarding.photo.rights')}
      </AppText>
    </View>
  );
}

const SAMPLE_SIZE = 56;

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  preview: { alignItems: 'center', paddingVertical: spacing.sm },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  actions: { gap: spacing.sm },
  samples: { gap: spacing.sm },
  sampleRow: { flexDirection: 'row', gap: spacing.md },
  sample: {
    width: SAMPLE_SIZE,
    height: SAMPLE_SIZE,
    minWidth: minTouch,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.stroke,
  },
  sampleSelected: { borderColor: colors.primary },
  sampleImage: { width: '100%', height: '100%' },
  subjects: { gap: spacing.sm },
  subjectRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tips: { gap: spacing.xs },
  tip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
