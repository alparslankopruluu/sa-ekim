import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion, ZoomIn } from 'react-native-reanimated';

import type { ErrorCode } from '@shared/api';
import type { Goal } from '@shared/catalog';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { EqualizerBars } from '@/components/EqualizerBars';
import { ProgressRing } from '@/components/ProgressRing';
import { colors, radius, spacing } from '@/theme/tokens';

import { checklistStates, type PreviewStage, ringProgress } from './previewProgress';
import { canRetryPreview, type RenderPhase } from './usePreviewRender';

const PENDING = 'pending' as const;

/** The skip / cancel-for-now escape hatch appears after this long. */
export const SKIP_AFTER_MS = 20_000;
/** Lets the last line visibly tick before moving on to the reveal. */
const READY_HOLD_MS = 700;
const RING = 208;
const PHOTO = 128;

const LINE_KEYS = [
  'onboarding.crafting.lineUpload',
  'onboarding.crafting.lineReserve',
  'onboarding.crafting.lineEdit',
  'onboarding.crafting.lineFinish',
] as const;

const AREA = {
  hairline: 'onboarding.crafting.area.hairline',
  crown: 'onboarding.crafting.area.crown',
  part: 'onboarding.crafting.area.part',
  brows: 'onboarding.crafting.area.brows',
  beard: 'onboarding.crafting.area.beard',
} as const satisfies Record<Goal, string>;

export interface CraftingStepProps {
  phase: RenderPhase;
  stage: PreviewStage;
  progress: number;
  errorCode: ErrorCode | null;
  goal: Goal | null;
  photoUri: string | null;
  /** The preview finished: show the reveal. */
  onReady: () => void;
  /** Leave without a preview (it keeps rendering in the background when it was still running). */
  onSkip: () => void;
  onRetry: () => void;
}

/** Synthesis screen: every line ticks from a real status transition, never from a timer. */
export function CraftingStep({ phase, stage, progress, errorCode, goal, photoUri, onReady, onSkip, onRetry }: CraftingStepProps) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [canSkip, setCanSkip] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setCanSkip(true), SKIP_AFTER_MS);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (phase !== 'ready') return;
    const id = setTimeout(onReady, READY_HOLD_MS);
    return () => clearTimeout(id);
  }, [onReady, phase]);

  useEffect(() => {
    if (phase === 'skipped') onSkip();
  }, [onSkip, phase]);

  if (phase === 'failed') {
    const code = errorCode ?? 'unknown';
    const body =
      code === 'offline'
        ? t('onboarding.crafting.failedOffline')
        : code === 'content_blocked' || code === 'invalid_input'
          ? t('onboarding.crafting.failedBlocked')
          : t('onboarding.crafting.failedGeneric');
    return (
      <Animated.View entering={FadeIn} style={styles.failed} accessibilityRole="alert">
        <Ionicons name="cloud-offline-outline" size={48} color={colors.warning} />
        <AppText variant="title2" align="center" accessibilityRole="header">
          {t('onboarding.crafting.failedTitle')}
        </AppText>
        <AppText variant="body" color="textSecondary" align="center">
          {body}
        </AppText>
        <View style={styles.failedActions}>
          {canRetryPreview(code) ? <Button label={t('common.retry')} onPress={onRetry} icon="refresh" testID="crafting-retry" /> : null}
          <Button label={t('onboarding.crafting.skipFailed')} onPress={onSkip} variant="secondary" size="md" testID="crafting-skip" />
        </View>
      </Animated.View>
    );
  }

  const ready = phase === 'ready';
  const value = ringProgress(stage, progress);
  const states = checklistStates(stage);
  const area = t(goal ? AREA[goal] : AREA.hairline);
  const labels = LINE_KEYS.map((key) => (key === 'onboarding.crafting.lineEdit' ? t(key, { area }) : t(key)));
  const stateLabel = { done: t('onboarding.crafting.stateDone'), active: t('onboarding.crafting.stateActive'), pending: t('onboarding.crafting.statePending') };

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t('onboarding.crafting.ringLabel', { percent: Math.round(value * 100) })}
          accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
        >
          <ProgressRing progress={value} size={RING}>
            <View style={styles.photo}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <Ionicons name="person-outline" size={PHOTO * 0.4} color={colors.textTertiary} />
              )}
            </View>
          </ProgressRing>
        </View>
        <Animated.View key={ready ? 'done' : 'working'} entering={reduceMotion ? FadeIn : ZoomIn.springify()} style={styles.title}>
          <AppText variant="title1" align="center" accessibilityRole="header" accessibilityLiveRegion="polite">
            {ready ? t('onboarding.crafting.titleDone') : t('onboarding.crafting.title')}
          </AppText>
          {!ready ? (
            <>
              <AppText variant="callout" color="textSecondary" align="center">
                {t('onboarding.crafting.subtitle')}
              </AppText>
              <View style={styles.eq}>
                <EqualizerBars bars={7} height={20} color="primary" />
              </View>
            </>
          ) : null}
        </Animated.View>
      </View>

      <View style={styles.checklist}>
        {labels.map((label, index) => {
          const state = states[index] ?? PENDING;
          return (
            <View
              key={LINE_KEYS[index]}
              style={styles.row}
              accessible
              accessibilityLabel={`${label}, ${stateLabel[state]}`}
              testID={`crafting-line-${index}`}
            >
              <View style={[styles.check, state === 'done' && styles.checkDone, state === 'active' && styles.checkActive]}>
                {state === 'done' ? (
                  <Animated.View entering={reduceMotion ? FadeIn : ZoomIn.springify()}>
                    <Ionicons name="checkmark" size={14} color={colors.textOnAccent} />
                  </Animated.View>
                ) : null}
              </View>
              <AppText variant="callout" color={state === 'pending' ? 'textTertiary' : 'text'} style={styles.rowText}>
                {label}
              </AppText>
            </View>
          );
        })}
      </View>

      <View style={styles.skipSlot}>
        {canSkip && !ready ? (
          <Animated.View entering={FadeIn} style={styles.skip}>
            <Button label={t('onboarding.crafting.skip')} onPress={onSkip} variant="secondary" size="md" testID="crafting-skip" />
            <AppText variant="caption" color="textTertiary" align="center">
              {t('onboarding.crafting.skipNote')}
            </AppText>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between', paddingBottom: spacing.lg, gap: spacing.lg },
  center: { alignItems: 'center', gap: spacing.lg, marginTop: spacing.lg },
  photo: {
    width: PHOTO,
    height: PHOTO,
    borderRadius: PHOTO / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  title: { alignItems: 'center', gap: spacing.sm },
  eq: { height: 22 },
  checklist: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 28 },
  rowText: { flex: 1 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.strokeStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkActive: { borderColor: colors.primary },
  checkDone: { backgroundColor: colors.sage, borderColor: colors.sage },
  skipSlot: { minHeight: 84, justifyContent: 'flex-end' },
  skip: { gap: spacing.xs },
  failed: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  failedActions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.lg },
});
