import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { Goal, Stage } from '@shared/catalog';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { PhotoPicker } from '@/components/PhotoPicker';
import { track } from '@/services/analytics';
import { usePreviewDraft } from '@/stores/previewDraft';
import { useSession } from '@/stores/session';
import { spacing } from '@/theme/tokens';

import { primaryAngleFor } from './flow';
import { useEntering } from './motion';
import { StepScaffold } from './StepScaffold';

const SUBTITLE = {
  researching: 'onboarding.photo.subtitleResearching',
  planned: 'onboarding.photo.subtitlePlanned',
  done: 'onboarding.photo.subtitleDone',
} as const satisfies Record<Stage, string>;

const ANGLE_TIP = {
  front: 'onboarding.photo.angle.front',
  left: 'onboarding.photo.angle.front',
  right: 'onboarding.photo.angle.front',
  top: 'onboarding.photo.angle.top',
  crown: 'onboarding.photo.angle.crown',
} as const;

const AREA_TIP = {
  hairline: 'onboarding.photo.area.hairline',
  crown: 'onboarding.photo.area.crown',
  part: 'onboarding.photo.area.part',
  brows: 'onboarding.photo.area.brows',
  beard: 'onboarding.photo.area.beard',
} as const satisfies Record<Goal, string>;

/** Photo → guidance, guided camera, library, or skip (no preview). */
export function PhotoStep({ onContinue, onSkip }: { onContinue: () => void; onSkip: () => void }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const goal = useSession((s) => s.goal);
  const stage = useSession((s) => s.stage);
  const photo = usePreviewDraft((s) => s.photo);
  const setPhoto = usePreviewDraft((s) => s.setPhoto);
  const header = useEntering('up');
  const lastTracked = useRef<string | null>(null);

  // The onboarding preview needs a draft that knows the goal; keep an existing photo.
  useEffect(() => {
    if (!goal) return;
    const draft = usePreviewDraft.getState();
    if (draft.goal !== goal || !draft.onboarding) {
      const keep = draft.photo;
      draft.start({ goal, onboarding: true });
      if (keep) usePreviewDraft.getState().setPhoto(keep);
    }
  }, [goal]);

  // One `photo_selected` per new photo, wherever it came from (library or the capture screen).
  useEffect(() => {
    if (!photo || lastTracked.current === photo.localUri) return;
    lastTracked.current = photo.localUri;
    track('photo_selected', { source: photo.source });
  }, [photo]);

  const openCamera = () => {
    router.push({ pathname: '/capture', params: { mode: 'preview', angle: primaryAngleFor(goal) } });
  };

  const tips = [
    t(ANGLE_TIP[primaryAngleFor(goal)]),
    ...(goal ? [t(AREA_TIP[goal])] : []),
    t('onboarding.photo.light'),
  ];

  return (
    <StepScaffold
      contentStyle={styles.content}
      footer={
        <>
          <Button
            label={t('common.continue')}
            onPress={onContinue}
            disabled={!photo}
            shine={!!photo}
            testID="photo-continue"
          />
          <Button label={t('onboarding.photo.skip')} onPress={onSkip} variant="ghost" size="md" testID="photo-skip" />
          <AppText variant="caption" color="textTertiary" align="center">
            {t('onboarding.photo.skipNote')}
          </AppText>
        </>
      }
    >
      <Animated.View entering={header} style={styles.header}>
        <AppText variant="title1" accessibilityRole="header">
          {t('onboarding.photo.title')}
        </AppText>
        <AppText variant="body" color="textSecondary">
          {t(SUBTITLE[stage ?? 'researching'])}
        </AppText>
      </Animated.View>
      <View>
        <PhotoPicker
          photo={photo}
          onChange={setPhoto}
          onCamera={openCamera}
          previewSize={Math.min(180, width * 0.44)}
          tips={tips}
        />
      </View>
    </StepScaffold>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg },
  header: { gap: spacing.sm, marginTop: spacing.md },
});
