/**
 * Rendering: uploads the photo, creates the preview (idempotent) and follows the PreviewDoc.
 *
 * Route params (optional):
 *   previewId  attach to an existing preview (in-flight/failed card in the Previews tab, or a
 *              "preview ready" notification for one that has not finished). Without it the
 *              screen runs the submission the picker just began (features/preview/submitStore).
 *
 * The submission and the server render live outside this screen: leaving keeps them running,
 * the Previews tab shows the in-flight badge and `notifications`/`session` announce completion.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ErrorCode } from '@shared/api';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { ProgressRing } from '@/components/ProgressRing';
import { StageBackground } from '@/components/StageBackground';
import { showToast } from '@/components/Toast';
import { CloseButton } from '@/components/ui';
import { prefillDraftFromPreview } from '@/features/preview/draftFromPreview';
import { beginAttempt, runSubmit, usePreviewSubmit } from '@/features/preview/submitStore';
import { useMediaUrl } from '@/features/preview/useMediaUrl';
import { useEntitlement } from '@/lib/entitlements';
import { useErrorMessage } from '@/lib/errors';
import {
  creditsAction,
  displayProgress,
  errorUx,
  isInFlightStatus,
  refundedCredits,
  renderStage,
  validateDraft,
} from '@/lib/previewFlow';
import { track, trackScreen } from '@/services/analytics';
import { cancelPreview } from '@/services/generation';
import { getPermissionState, requestPermission } from '@/services/notifications';
import { useAccount } from '@/stores/account';
import { usePreviewDraft } from '@/stores/previewDraft';
import { colors, layout, spacing } from '@/theme/tokens';

const RING = 236;

export default function RenderingScreen() {
  const { t } = useTranslation();
  const message = useErrorMessage();
  const reduceMotion = useReducedMotion();
  const params = useLocalSearchParams<{ previewId?: string }>();
  const { isPro } = useEntitlement();
  const balance = useAccount((s) => s.wallet.balance);

  const [attachedId, setAttachedId] = useState<string | null>(params.previewId ?? null);
  const phase = usePreviewSubmit((s) => s.phase);
  const submitId = usePreviewSubmit((s) => s.previewId);
  const submitError = usePreviewSubmit((s) => s.errorCode);
  const failedStage = usePreviewSubmit((s) => s.failedStage);
  const startedAt = usePreviewSubmit((s) => s.startedAt);
  const previewId = attachedId ?? submitId;
  const doc = useAccount((s) => (previewId ? s.previews.find((p) => p.id === previewId) : undefined));
  const draftPhoto = usePreviewDraft((s) => s.photo);

  const [now, setNow] = useState(() => Date.now());
  const [notify, setNotify] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [canceling, setCanceling] = useState(false);
  const [busy, setBusy] = useState(false);

  const stage = renderStage({ phase, previewId, doc });
  const working = !['succeeded', 'failed', 'canceled', 'submit_error'].includes(stage);

  // Start the submission the picker began. Re-entering while it runs or finished only observes.
  useEffect(() => {
    trackScreen('preview_rendering');
    void getPermissionState().then(setNotify);
    if (!params.previewId && usePreviewSubmit.getState().phase === 'idle') void runSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!working) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [working]);

  useEffect(() => {
    if (stage === 'succeeded' && doc) {
      router.replace({ pathname: '/preview/result', params: { previewId: doc.id } });
    }
  }, [stage, doc]);

  // The ring shows the user's own photo: the local draft when it is the same upload, else the stored selfie.
  const localPhoto = draftPhoto && (!doc || draftPhoto.storagePath === doc.photoPath || !attachedId) ? draftPhoto.localUri : null;
  const remotePhoto = useMediaUrl(localPhoto ? null : doc?.photoPath);
  const photoUri = localPhoto ?? remotePhoto.uri;

  const origin = attachedId ? (doc?.createdAt ?? now) : (startedAt ?? now);
  const progress = displayProgress(stage, doc?.progress ?? 0, now - origin);
  const percent = Math.round(progress * 100);

  const leave = () => router.replace('/(tabs)/previews');
  const close = () => (router.canGoBack() ? router.back() : leave());
  const backToPicker = () => {
    if (!attachedId && router.canGoBack()) {
      router.back();
      return;
    }
    router.replace({
      pathname: '/preview',
      params: { keep: '1', goal: doc?.goal ?? usePreviewDraft.getState().goal ?? undefined },
    });
  };

  const cancel = async () => {
    if (!doc) return;
    setCanceling(true);
    try {
      const response = await cancelPreview(doc.id);
      track('preview_cancel', { quality: doc.quality });
      if (!response.canceled) showToast(t('preview.rendering.cancelTooLate'), 'info');
    } catch (error) {
      showToast(message(error), 'error');
    } finally {
      setCanceling(false);
    }
  };

  /** A create-stage error keeps its key (server replay); a finished failure starts a new attempt. */
  const retry = async () => {
    if (stage === 'submit_error') {
      void runSubmit();
      return;
    }
    if (!doc) return;
    setBusy(true);
    try {
      if (!validateDraft(usePreviewDraft.getState()).ok || usePreviewDraft.getState().photo?.storagePath !== doc.photoPath) {
        await prefillDraftFromPreview(doc);
      }
      if (!validateDraft(usePreviewDraft.getState()).ok) {
        backToPicker();
        return;
      }
      setAttachedId(null);
      beginAttempt();
      void runSubmit();
    } finally {
      setBusy(false);
    }
  };

  const onAction = (action: ReturnType<typeof errorUx>['action']) => {
    switch (action) {
      case 'retry':
        void retry();
        return;
      case 'credits': {
        const next = creditsAction({ isPro, balance });
        if (next.kind === 'paywall') router.push({ pathname: '/paywall', params: { source: next.source } });
        else router.push({ pathname: '/credits', params: { source: 'preview' } });
        return;
      }
      case 'consent':
        router.push('/consent');
        return;
      case 'paywall':
        router.push({ pathname: '/paywall', params: { source: 'locked_hd' } });
        return;
      case 'change_photo':
        usePreviewDraft.getState().setPhoto(null);
        backToPicker();
        return;
      default:
        leave();
    }
  };

  if (stage === 'failed' || stage === 'canceled' || stage === 'submit_error') {
    const canceled = stage === 'canceled';
    const code: ErrorCode = stage === 'submit_error' ? (submitError ?? 'unknown') : (doc?.errorCode ?? 'provider_failed');
    const ux = errorUx(code);
    const refunded = doc ? refundedCredits(doc) : 0;
    const title = canceled
      ? t('preview.rendering.canceledTitle')
      : code === 'offline'
        ? t('preview.rendering.offlineTitle')
        : stage === 'submit_error'
          ? t('preview.rendering.errorTitle')
          : t('preview.rendering.failedTitle');
    const note =
      refunded > 0
        ? t('preview.rendering.refunded', { count: refunded })
        : stage === 'submit_error' && failedStage === 'create' && ux.retryable
          ? t('preview.rendering.retrySafe')
          : t('preview.rendering.nothingCharged');
    const icon = canceled ? 'close-circle-outline' : code === 'offline' ? 'cloud-offline-outline' : 'alert-circle-outline';

    const actionLabel: Record<typeof ux.action, string> = {
      retry: t('preview.rendering.retry'),
      credits: t('preview.rendering.getCredits'),
      consent: t('preview.rendering.reviewConsent'),
      paywall: t('preview.rendering.seePlans'),
      change_photo: t('preview.rendering.choosePhoto'),
      close: t('preview.rendering.close'),
    };

    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <StageBackground animated={false} intensity="soft" accents={[colors.warning, colors.primary]} />
        <View style={styles.topBar}>
          <View />
          <CloseButton onPress={close} />
        </View>
        <Animated.View entering={reduceMotion ? undefined : FadeIn} style={styles.center} accessibilityRole="alert">
          <Ionicons name={icon} size={56} color={canceled ? colors.textSecondary : colors.warning} />
          <AppText variant="title1" align="center" accessibilityRole="header">
            {title}
          </AppText>
          {canceled ? null : (
            <AppText variant="body" color="textSecondary" align="center">
              {message(code)}
            </AppText>
          )}
          <AppText variant="callout" color="textSecondary" align="center">
            {note}
          </AppText>
        </Animated.View>
        <View style={styles.footer}>
          {canceled ? (
            <Button label={t('preview.rendering.backToStyles')} onPress={backToPicker} />
          ) : (
            <>
              <Button label={actionLabel[ux.action]} onPress={() => onAction(ux.action)} loading={busy} testID="rendering-primary" />
              {ux.action !== 'close' ? (
                <Button label={t('preview.rendering.backToStyles')} variant="secondary" size="md" onPress={backToPicker} />
              ) : null}
            </>
          )}
          <Button label={t('preview.rendering.close')} variant="ghost" size="md" onPress={leave} />
        </View>
      </SafeAreaView>
    );
  }

  const canCancel = !!doc && (doc.status === 'queued' || doc.status === 'processing');
  const statusText = t(`preview.rendering.status.${stage === 'succeeded' ? 'finalizing' : stage}`);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StageBackground animated={false} accents={[colors.primary, colors.accent]} />
      <View style={styles.topBar}>
        <View />
        <CloseButton onPress={close} />
      </View>
      <ScrollView contentContainerStyle={styles.centerScroll} showsVerticalScrollIndicator={false}>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t('preview.rendering.ringA11y', { percent })}
          accessibilityValue={{ min: 0, max: 100, now: percent }}
        >
          <ProgressRing progress={progress} size={RING} stroke={12}>
            <View style={styles.photo} accessibilityLabel={t('preview.rendering.photoA11y')}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
              ) : (
                <Ionicons name="person-circle-outline" size={64} color={colors.textTertiary} />
              )}
            </View>
          </ProgressRing>
        </View>
        <View style={styles.texts}>
          <AppText variant="title1" align="center" accessibilityRole="header">
            {t('preview.rendering.title')}
          </AppText>
          <AppText variant="body" color="textSecondary" align="center" accessibilityLiveRegion="polite">
            {statusText}
          </AppText>
          <AppText variant="caption" color="textTertiary" align="center">
            {t('preview.rendering.estimate')}
          </AppText>
          <AppText variant="caption" color="textTertiary" align="center">
            {t('preview.rendering.background')}
          </AppText>
          <AppText variant="caption" color="accent" align="center">
            {t('preview.aiLabel')}
          </AppText>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        {notify === 'granted' ? (
          <View style={styles.notified}>
            <Ionicons name="notifications" size={16} color={colors.success} />
            <AppText variant="callout" color="success">
              {t('preview.rendering.notifyOn')}
            </AppText>
          </View>
        ) : notify === 'undetermined' ? (
          <Button
            label={t('preview.rendering.notifyMe')}
            icon="notifications-outline"
            variant="secondary"
            size="md"
            onPress={() => void requestPermission('preview_rendering').then((ok) => setNotify(ok ? 'granted' : 'denied'))}
          />
        ) : null}
        <Button label={t('preview.rendering.keepBrowsing')} variant="secondary" size="md" onPress={leave} testID="rendering-leave" />
        {canCancel && doc && isInFlightStatus(doc.status) ? (
          <View style={styles.cancel}>
            <Button
              label={t('preview.rendering.cancel')}
              variant="ghost"
              size="sm"
              loading={canceling}
              onPress={() => void cancel()}
              testID="rendering-cancel"
            />
            <AppText variant="caption" color="textTertiary" align="center">
              {t('preview.rendering.cancelHint')}
            </AppText>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: layout.screenPadding },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 52 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingHorizontal: spacing.md },
  centerScroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    paddingVertical: spacing.lg,
  },
  photo: {
    width: RING - 48,
    height: RING - 48,
    borderRadius: (RING - 48) / 2,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { alignItems: 'center', gap: spacing.sm, maxWidth: layout.maxContentWidth },
  footer: { gap: spacing.sm, paddingBottom: spacing.lg, width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' },
  notified: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, minHeight: 44 },
  cancel: { alignItems: 'center', gap: spacing.xxs },
});
