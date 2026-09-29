/**
 * Photo detail: the photo large, its angle and week, "Compare with…", and delete (with a
 * confirmation). Deleting removes the file from the journey directory and the store entry.
 */
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { dayIndex } from '@shared/timeline';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { showToast } from '@/components/Toast';
import { Badge, CloseButton, EmptyState } from '@/components/ui';
import { formatTakenAt, useWeekLabel } from '@/features/compare/useWeekLabel';
import { useFeedback } from '@/hooks/useFeedback';
import { currentLocaleTag } from '@/lib/i18n';
import { track } from '@/services/analytics';
import { recordNonFatal } from '@/services/crash';
import { removeJourneyFile, resolveJourneyUri } from '@/services/journeyFiles';
import { useJourney } from '@/stores/journey';
import { colors, layout, radius, spacing } from '@/theme/tokens';

export default function PhotoDetailScreen() {
  const { t } = useTranslation();
  const feedback = useFeedback();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const photo = useJourney((s) => s.photos.find((p) => p.id === id));
  const photoCount = useJourney((s) => s.photos.length);
  const procedureDate = useJourney((s) => s.procedureDate);
  const weekLabel = useWeekLabel(procedureDate);
  const { width, height } = useWindowDimensions();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  if (!photo) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.top}>
          <View style={styles.flex} />
          <CloseButton onPress={() => router.back()} />
        </View>
        <EmptyState
          emoji="🗂️"
          title={t('capture.detail.missingTitle')}
          body={t('capture.detail.missingBody')}
          action={{ label: t('capture.detail.close'), onPress: () => router.back() }}
        />
      </SafeAreaView>
    );
  }

  const angle = t(`capture.angle.${photo.angle}`);
  const label = weekLabel(photo.takenAt);
  const date = formatTakenAt(photo.takenAt, currentLocaleTag());
  const imageWidth = Math.min(width - layout.screenPadding * 2, layout.maxContentWidth);
  const imageHeight = Math.min(imageWidth * (4 / 3), height * 0.62);

  const remove = async () => {
    setDeleting(true);
    try {
      await removeJourneyFile(photo.uri);
      useJourney.getState().removePhoto(photo.id);
      track('photo_deleted', { day: procedureDate ? dayIndex(procedureDate, new Date(photo.takenAt)) : -1 });
      feedback.success();
      setConfirming(false);
      router.back();
    } catch (error) {
      recordNonFatal(error, 'photo_delete');
      showToast(t('errors.unknown'), 'error');
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <AppText variant="title2" accessibilityRole="header" style={styles.flex}>
          {t('capture.detail.title')}
        </AppText>
        <CloseButton onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.frame, { width: imageWidth, height: imageHeight }]}>
          {loadFailed ? (
            <View style={styles.failed}>
              <AppText variant="callout" color="textSecondary" align="center">
                {t('capture.detail.loadError')}
              </AppText>
            </View>
          ) : (
            <Image
              source={{ uri: resolveJourneyUri(photo.uri) }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={160}
              onError={() => setLoadFailed(true)}
              accessible
              accessibilityLabel={t('capture.detail.image', { angle, label })}
            />
          )}
        </View>

        <View style={styles.meta}>
          <View style={styles.badges}>
            <Badge label={label} />
            <Badge label={angle} tone="muted" />
          </View>
          <AppText variant="callout" color="textSecondary">
            {t('capture.detail.taken', { date })}
          </AppText>
        </View>

        <View style={styles.actions}>
          {photoCount > 1 ? (
            <Button
              label={t('capture.detail.compare')}
              icon="git-compare-outline"
              variant="secondary"
              onPress={() => router.push({ pathname: '/compare', params: { a: photo.id } })}
              testID="photo-compare"
            />
          ) : null}
          <Button
            label={t('capture.detail.delete')}
            icon="trash-outline"
            variant="danger"
            onPress={() => setConfirming(true)}
            testID="photo-delete"
          />
        </View>
      </ScrollView>

      <ConfirmSheet
        visible={confirming}
        title={t('capture.detail.confirmTitle')}
        body={t('capture.detail.confirmBody')}
        confirmLabel={t('capture.detail.confirm')}
        cancelLabel={t('capture.detail.cancel')}
        destructive
        loading={deleting}
        onConfirm={() => void remove()}
        onCancel={() => setConfirming(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgElevated },
  flex: { flex: 1 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  content: { paddingHorizontal: layout.screenPadding, paddingBottom: spacing.huge, gap: spacing.xl, alignItems: 'center' },
  frame: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.strokeStrong,
  },
  failed: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  meta: { alignSelf: 'stretch', gap: spacing.sm },
  badges: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  actions: { alignSelf: 'stretch', gap: spacing.md },
});
