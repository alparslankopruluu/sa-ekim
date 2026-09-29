import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { PreviewDoc } from '@shared/api';

import { AppText } from '@/components/AppText';
import { BeforeAfterWipe } from '@/components/BeforeAfterWipe';
import { Button } from '@/components/Button';
import { Confetti } from '@/components/Confetti';
import { Skeleton } from '@/components/ui';
import { useFeedback } from '@/hooks/useFeedback';
import { track } from '@/services/analytics';
import { recordNonFatal } from '@/services/crash';
import { resolveMediaUrl } from '@/services/generation';
import { useSession } from '@/stores/session';
import { colors, layout, radius, spacing } from '@/theme/tokens';

import { useEntering } from './motion';
import { StepScaffold } from './StepScaffold';

type Load = { state: 'loading' } | { state: 'ready'; url: string } | { state: 'error' };

const WIPE_HEIGHT = 380;

/** Real result of the free preview: wipe against the user's own photo, always labelled as AI. */
export function RevealStep({ preview, photoUri, onDone }: { preview: PreviewDoc | undefined; photoUri: string | null; onDone: () => void }) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const feedback = useFeedback();
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const header = useEntering('up');
  const stage = useEntering('up', 140);
  const resultPath = preview?.status === 'succeeded' ? preview.resultPath : null;
  const previewId = preview?.id;

  useEffect(() => {
    if (!resultPath) {
      setLoad({ state: 'error' });
      return;
    }
    let cancelled = false;
    setLoad({ state: 'loading' });
    resolveMediaUrl(resultPath)
      .then((url) => {
        if (!cancelled) setLoad({ state: 'ready', url });
      })
      .catch((error: unknown) => {
        recordNonFatal(error, 'onboarding_reveal_url');
        if (!cancelled) setLoad({ state: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [resultPath, attempt]);

  const ready = load.state === 'ready' && !!photoUri;

  useEffect(() => {
    if (!ready || !previewId) return;
    feedback.success();
    track('result_view', { first: true, onboarding: true });
    useSession.getState().markResultSeen(previewId);
    // Fire once per preview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, previewId]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const frameWidth = Math.min(width - layout.screenPadding * 2, layout.maxContentWidth);

  return (
    <StepScaffold
      contentStyle={styles.content}
      footer={<Button label={t('onboarding.reveal.cta')} onPress={onDone} shine testID="reveal-cta" />}
    >
      <Animated.View entering={header} style={styles.header}>
        <AppText variant="title1" align="center" accessibilityRole="header">
          {t('onboarding.reveal.title')}
        </AppText>
        <AppText variant="body" color="textSecondary" align="center">
          {t('onboarding.reveal.subtitle')}
        </AppText>
      </Animated.View>

      <Animated.View entering={stage} style={styles.stage}>
        {ready && load.state === 'ready' && photoUri ? (
          <BeforeAfterWipe
            beforeUri={photoUri}
            afterUri={load.url}
            beforeLabel={t('onboarding.reveal.before')}
            afterLabel={t('onboarding.reveal.after')}
            accessibilityLabel={t('onboarding.reveal.wipeLabel')}
            height={WIPE_HEIGHT}
            initial={0.5}
          />
        ) : load.state === 'error' || !photoUri ? (
          <View style={[styles.fallback, { width: frameWidth, height: WIPE_HEIGHT * 0.6 }]} accessibilityRole="alert">
            <Ionicons name="image-outline" size={36} color={colors.textTertiary} />
            <AppText variant="callout" color="textSecondary" align="center">
              {t('onboarding.reveal.loadFailed')}
            </AppText>
            {resultPath ? <Button label={t('common.retry')} onPress={retry} variant="secondary" size="sm" icon="refresh" /> : null}
          </View>
        ) : (
          <View accessibilityLabel={t('onboarding.reveal.loading')} accessibilityRole="progressbar">
            <Skeleton style={{ width: frameWidth, height: WIPE_HEIGHT, borderRadius: radius.lg }} />
          </View>
        )}
        <View style={styles.labels}>
          <View style={styles.disclaimer}>
            <Ionicons name="sparkles-outline" size={14} color={colors.accent} />
            <AppText variant="caption" color="textSecondary" style={styles.disclaimerText} testID="reveal-disclaimer">
              {t('onboarding.reveal.disclaimer')}
            </AppText>
          </View>
          <AppText variant="caption" color="textTertiary" align="center">
            {t('onboarding.reveal.watermark')}
          </AppText>
        </View>
      </Animated.View>
      <Confetti fireKey={ready ? 1 : 0} />
    </StepScaffold>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg },
  header: { gap: spacing.sm, marginTop: spacing.md },
  stage: { gap: spacing.md },
  fallback: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke,
  },
  labels: { gap: spacing.xs, alignItems: 'center' },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.strokeStrong,
  },
  disclaimerText: { flexShrink: 1 },
});
