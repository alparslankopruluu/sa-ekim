import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { I18nManager, StyleSheet, View } from 'react-native';

import type { Angle } from '@shared/catalog';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { PressableScale } from '@/components/PressableScale';
import type { PhotoDraft } from '@/stores/previewDraft';
import { colors, minTouch, radius, spacing } from '@/theme/tokens';

export interface JourneyOption {
  uri: string;
  angle: Angle;
  dateLabel: string;
}

export interface PhotoSectionProps {
  photo: PhotoDraft | null;
  journey: JourneyOption | null;
  onTake: () => void;
  onLibrary: () => void;
  onJourney: () => void;
  onRemove: () => void;
}

/** Photo step of the picker: take, choose from the library, or reuse the latest journey photo. */
export function PhotoSection({ photo, journey, onTake, onLibrary, onJourney, onRemove }: PhotoSectionProps) {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      <View style={styles.previewRow}>
        <View style={styles.thumb} accessible accessibilityLabel={photo ? t('preview.photo.selected') : t('preview.photo.empty')}>
          {photo ? (
            <Image source={{ uri: photo.localUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
          ) : (
            <Ionicons name="person-circle-outline" size={44} color={colors.textTertiary} />
          )}
        </View>
        <View style={styles.previewText}>
          <AppText variant="bodyStrong">{photo ? t('preview.photo.selected') : t('preview.photo.empty')}</AppText>
          <AppText variant="caption" color="textSecondary">
            {t('preview.photo.sentNote')}
          </AppText>
          {photo ? (
            <PressableScale
              onPress={onRemove}
              accessibilityLabel={t('preview.photo.remove')}
              style={styles.remove}
              testID="preview-photo-remove"
            >
              <Ionicons name="close-circle-outline" size={16} color={colors.textSecondary} />
              <AppText variant="caption" color="textSecondary">
                {t('preview.photo.remove')}
              </AppText>
            </PressableScale>
          ) : null}
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          label={t('preview.photo.take')}
          icon="camera-outline"
          variant={photo ? 'secondary' : 'primary'}
          size="md"
          onPress={onTake}
          testID="preview-photo-take"
        />
        <Button
          label={t('preview.photo.library')}
          icon="images-outline"
          variant="secondary"
          size="md"
          onPress={onLibrary}
          testID="preview-photo-library"
        />
        {journey ? (
          <PressableScale
            onPress={onJourney}
            accessibilityLabel={t('preview.photo.journey')}
            accessibilityHint={t('preview.photo.journeySub', {
              angle: t(`preview.angles.${journey.angle}`),
              date: journey.dateLabel,
            })}
            style={styles.journey}
            testID="preview-photo-journey"
          >
            <Image source={{ uri: journey.uri }} style={styles.journeyThumb} contentFit="cover" />
            <View style={styles.journeyText}>
              <AppText variant="callout">{t('preview.photo.journey')}</AppText>
              <AppText variant="caption" color="textSecondary">
                {t('preview.photo.journeySub', { angle: t(`preview.angles.${journey.angle}`), date: journey.dateLabel })}
              </AppText>
            </View>
            <Ionicons name={I18nManager.isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.textTertiary} />
          </PressableScale>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  previewRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  thumb: {
    width: 84,
    height: 108,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.strokeStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewText: { flex: 1, gap: spacing.xs },
  remove: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: minTouch - 12 },
  actions: { gap: spacing.sm },
  journey: {
    minHeight: minTouch + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke,
  },
  journeyThumb: { width: 44, height: 56, borderRadius: radius.sm, backgroundColor: colors.surfaceHigh },
  journeyText: { flex: 1, gap: 2 },
});
