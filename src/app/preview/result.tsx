/**
 * Result: before/after wipe, the permanent "AI preview" label, save / share / report / delete,
 * "try another style" and, after the free watermarked preview, the HD upsell.
 *
 * Route params: previewId (required).
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { previewCost } from '@shared/pricing';

import { AppText } from '@/components/AppText';
import { BeforeAfterWipe } from '@/components/BeforeAfterWipe';
import { Button } from '@/components/Button';
import { Confetti } from '@/components/Confetti';
import { PressableScale } from '@/components/PressableScale';
import { StageBackground } from '@/components/StageBackground';
import { showToast } from '@/components/Toast';
import { Badge, Card, CloseButton, ErrorState, Skeleton } from '@/components/ui';
import { prefillDraftFromPreview } from '@/features/preview/draftFromPreview';
import { ExportError, isExportableImage, savePreviewImage, sharePreviewImage } from '@/features/preview/exportImage';
import { formatDate } from '@/features/preview/format';
import { useDeletePreview } from '@/features/preview/useDeletePreview';
import { useMediaUrl } from '@/features/preview/useMediaUrl';
import { useFeedback } from '@/hooks/useFeedback';
import { useEntitlement } from '@/lib/entitlements';
import { useErrorMessage } from '@/lib/errors';
import { expiresSoon, isExpired, upgradeAction } from '@/lib/previewFlow';
import { track, trackScreen } from '@/services/analytics';
import { isMockBackend } from '@/services/backend';
import { maybeAskForReview } from '@/services/review';
import { useAccount } from '@/stores/account';
import { usePreviewDraft } from '@/stores/previewDraft';
import { useSession } from '@/stores/session';
import { colors, layout, radius, spacing } from '@/theme/tokens';

function ActionButton({
  icon,
  label,
  onPress,
  busy,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  busy?: boolean;
  testID?: string;
}) {
  return (
    <PressableScale onPress={onPress} disabled={busy} accessibilityLabel={label} style={styles.action} testID={testID}>
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={22} color={colors.text} />
      </View>
      <AppText variant="caption" align="center" numberOfLines={1}>
        {label}
      </AppText>
    </PressableScale>
  );
}

export default function ResultScreen() {
  const { t } = useTranslation();
  const message = useErrorMessage();
  const feedback = useFeedback();
  const reduceMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const params = useLocalSearchParams<{ previewId?: string }>();
  const { isPro } = useEntitlement();
  const wallet = useAccount((s) => s.wallet);
  const doc = useAccount((s) => s.previews.find((p) => p.id === params.previewId));
  const previewsState = useAccount((s) => s.previewsState);
  const draftPhoto = usePreviewDraft((s) => s.photo);
  const { confirmDelete, busyId } = useDeletePreview();

  const [now] = useState(() => Date.now());
  const [burst, setBurst] = useState(0);
  const [busy, setBusy] = useState<'save' | 'share' | 'again' | 'upgrade' | null>(null);
  const viewed = useRef(false);

  const expired = !!doc && (isExpired(doc.expiresAt, now) || (doc.status === 'succeeded' && !doc.resultPath));
  const after = useMediaUrl(doc && doc.status === 'succeeded' && !expired ? doc.resultPath : null);
  const localBefore = doc && draftPhoto && draftPhoto.storagePath === doc.photoPath ? draftPhoto.localUri : null;
  const remoteBefore = useMediaUrl(localBefore || !doc || expired ? null : doc.photoPath);
  const beforeUri = localBefore ?? remoteBefore.uri;

  useEffect(() => {
    trackScreen('preview_result');
  }, []);

  // Unfinished or failed previews belong to the rendering screen.
  useEffect(() => {
    if (doc && !expired && doc.status !== 'succeeded') {
      router.replace({ pathname: '/preview/rendering', params: { previewId: doc.id } });
    }
  }, [doc, expired]);

  useEffect(() => {
    if (!doc || doc.status !== 'succeeded' || expired || viewed.current) return;
    viewed.current = true;
    const first = useSession.getState().markResultSeen(doc.id);
    track('result_view', { first, onboarding: doc.onboarding });
    if (!first) return;
    useSession.getState().recordPreviewCompleted();
    feedback.success();
    // Start the burst on the next frame, once the wipe has laid out.
    const frame = requestAnimationFrame(() => setBurst(1));
    return () => cancelAnimationFrame(frame);
  }, [doc, expired, feedback]);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/previews'));
  const toPreviews = () => router.replace('/(tabs)/previews');

  if (!doc) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <View />
          <CloseButton onPress={close} />
        </View>
        {previewsState === 'ready' || previewsState === 'error' ? (
          <ErrorState message={t('preview.result.notFound')} onRetry={toPreviews} />
        ) : (
          <View style={styles.loading}>
            <Skeleton style={styles.skeleton} />
          </View>
        )}
      </SafeAreaView>
    );
  }

  if (expired) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <View />
          <CloseButton onPress={close} />
        </View>
        <View style={styles.expired} accessibilityRole="alert">
          <Ionicons name="time-outline" size={48} color={colors.textSecondary} />
          <AppText variant="title2" align="center" accessibilityRole="header">
            {t('preview.result.expiredTitle')}
          </AppText>
          <AppText variant="body" color="textSecondary" align="center">
            {t('preview.result.expiredBody')}
          </AppText>
          <Button label={t('preview.result.toPreviews')} onPress={toPreviews} variant="secondary" size="md" />
        </View>
      </SafeAreaView>
    );
  }

  const frameWidth = Math.min(width - layout.screenPadding * 2, layout.maxContentWidth);
  const frameHeight = Math.min(frameWidth * 1.25, height * 0.52);
  const styleName = t(`preview.styles.${doc.styleId}.name`);
  const soon = expiresSoon(doc.expiresAt, now);
  const upgrade = upgradeAction({ isPro, balance: wallet.balance, freeHighTokens: wallet.freeHighTokens });

  const withImage = async (action: 'save' | 'share') => {
    if (!isExportableImage(after.uri)) {
      showToast(t('preview.result.unsupported'), 'info');
      return;
    }
    setBusy(action);
    try {
      if (action === 'save') {
        await savePreviewImage(after.uri, doc.id);
        track('preview_saved', { quality: doc.quality });
        showToast(t('preview.result.saved'), 'success');
      } else {
        await sharePreviewImage(after.uri, doc.id);
        useSession.getState().recordShare();
        track('preview_shared', { quality: doc.quality });
        void maybeAskForReview('preview');
      }
    } catch (error) {
      if (error instanceof ExportError && error.reason === 'permission') showToast(t('preview.result.saveDenied'), 'error');
      else if (error instanceof ExportError && error.reason === 'unsupported') showToast(t('preview.result.unsupported'), 'info');
      else showToast(message(error), 'error');
    } finally {
      setBusy(null);
    }
  };

  const tryAnother = async () => {
    setBusy('again');
    try {
      await prefillDraftFromPreview(doc);
      router.replace({ pathname: '/preview', params: { keep: '1', goal: doc.goal } });
    } finally {
      setBusy(null);
    }
  };

  const onUpgrade = async () => {
    if (upgrade.kind === 'try_high') {
      setBusy('upgrade');
      try {
        await prefillDraftFromPreview(doc);
        usePreviewDraft.getState().setQuality('high');
        router.replace({ pathname: '/preview', params: { keep: '1', goal: doc.goal } });
      } finally {
        setBusy(null);
      }
      return;
    }
    track('feature_locked', { feature: 'hd' });
    if (upgrade.kind === 'paywall') router.push({ pathname: '/paywall', params: { source: upgrade.source } });
    else router.push({ pathname: '/credits', params: { source: 'result_upgrade' } });
  };

  const upgradeLabel =
    wallet.freeHighTokens > 0
      ? t('preview.result.upgradeTryFree')
      : t('preview.result.upgradeTry', { count: previewCost('high') });

  return (
    <View style={styles.root}>
      <StageBackground animated={false} intensity="soft" accents={[colors.primary, colors.accent]} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <View style={styles.titleRow}>
            <AppText variant="title2" accessibilityRole="header">
              {t('preview.result.title')}
            </AppText>
            {isMockBackend ? <Badge label={t('preview.result.demo')} tone="muted" /> : null}
          </View>
          <CloseButton onPress={close} testID="result-close" />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={{ width: frameWidth, height: frameHeight }}>
            {after.uri && beforeUri ? (
              <BeforeAfterWipe
                beforeUri={beforeUri}
                afterUri={after.uri}
                beforeLabel={t('preview.result.before')}
                afterLabel={t('preview.result.after')}
                height={frameHeight}
                mark={doc.watermarked ? t('preview.result.watermark') : undefined}
                accessibilityLabel={t('preview.result.wipeA11y')}
              />
            ) : after.uri ? (
              <View style={[styles.single, { height: frameHeight }]}>
                <Image source={{ uri: after.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                <View style={[styles.tag, styles.tagEnd]}>
                  <AppText variant="micro">{t('preview.result.after')}</AppText>
                </View>
                {doc.watermarked ? (
                  <View style={styles.mark}>
                    <AppText variant="micro" color="textSecondary">
                      {t('preview.result.watermark')}
                    </AppText>
                  </View>
                ) : null}
              </View>
            ) : after.failed ? (
              <ErrorState message={t('preview.result.loadFailed')} onRetry={after.reload} />
            ) : (
              <Skeleton style={{ width: frameWidth, height: frameHeight }} />
            )}
            {after.uri ? (
              <View style={styles.aiTag} pointerEvents="none">
                <AppText variant="micro" color="textOnAccent">
                  {t('preview.aiLabelShort')}
                </AppText>
              </View>
            ) : null}
          </View>

          <View style={styles.labels} accessible accessibilityLabel={`${t('preview.aiLabel')}. ${t('preview.aiLabelDetail')}`}>
            <View style={styles.aiRow}>
              <Ionicons name="information-circle-outline" size={18} color={colors.accent} />
              <AppText variant="callout" color="accent" style={styles.flex} testID="result-ai-label">
                {t('preview.aiLabel')}
              </AppText>
            </View>
            <AppText variant="caption" color="textSecondary">
              {t('preview.aiLabelDetail')}
            </AppText>
            {!beforeUri && remoteBefore.failed ? (
              <AppText variant="caption" color="textSecondary">
                {t('preview.result.beforeGone')}
              </AppText>
            ) : null}
            <AppText variant="caption" color="textTertiary">
              {t('preview.result.meta', {
                style: styleName,
                density: t(`preview.density.${doc.density}`),
                quality: t(`preview.quality.${doc.quality}.title`),
              })}
            </AppText>
            <AppText variant="caption" color={soon ? 'warning' : 'textTertiary'} testID="result-available-until">
              {t('preview.result.availableUntil', { date: formatDate(doc.expiresAt) })}
            </AppText>
          </View>

          <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(80)} style={styles.actions}>
            <ActionButton
              icon="download-outline"
              label={t('preview.result.save')}
              onPress={() => void withImage('save')}
              busy={busy === 'save'}
              testID="result-save"
            />
            <ActionButton
              icon="share-outline"
              label={t('preview.result.share')}
              onPress={() => void withImage('share')}
              busy={busy === 'share'}
              testID="result-share"
            />
            <ActionButton
              icon="flag-outline"
              label={t('preview.result.report')}
              onPress={() => router.push({ pathname: '/report', params: { previewId: doc.id } })}
              testID="result-report"
            />
            <ActionButton
              icon="trash-outline"
              label={t('preview.result.delete')}
              onPress={() => confirmDelete(doc, toPreviews)}
              busy={busyId === doc.id}
              testID="result-delete"
            />
          </Animated.View>

          <AppText variant="caption" color={soon ? 'warning' : 'textSecondary'} align="center">
            {soon ? t('preview.result.saveNudgeSoon') : t('preview.result.saveNudge')}
          </AppText>

          {doc.watermarked ? (
            <Card style={styles.upgrade}>
              <View style={styles.upgradeBody}>
                <AppText variant="headline">{t('preview.result.upgradeTitle')}</AppText>
                <AppText variant="callout" color="textSecondary">
                  {t('preview.result.upgradeBody')}
                </AppText>
                {upgrade.kind !== 'try_high' ? (
                  <AppText variant="caption" color="warning">
                    {t('preview.helper.needsCredits')}
                  </AppText>
                ) : null}
              </View>
              <Button
                label={upgradeLabel}
                variant="gold"
                icon="sparkles"
                size="md"
                loading={busy === 'upgrade'}
                onPress={() => void onUpgrade()}
                testID="result-upgrade"
              />
            </Card>
          ) : null}

          <Button
            label={t('preview.result.tryAnother')}
            variant="secondary"
            icon="color-wand-outline"
            loading={busy === 'again'}
            onPress={() => void tryAnother()}
            testID="result-try-another"
          />
        </ScrollView>
      </SafeAreaView>
      <Confetti fireKey={burst} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1, paddingHorizontal: layout.screenPadding },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: layout.screenPadding,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  scroll: {
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.lg,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  loading: { padding: layout.screenPadding },
  skeleton: { width: '100%', height: 420 },
  expired: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: layout.screenPadding },
  single: {
    width: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  tag: {
    position: 'absolute',
    top: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.scrim,
  },
  tagEnd: { end: spacing.md },
  mark: {
    position: 'absolute',
    bottom: spacing.md,
    end: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.scrim,
  },
  // Physical left like the wipe's own tags: the divider reads before -> after in every language.
  aiTag: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.scrim,
  },
  labels: { alignSelf: 'stretch', gap: spacing.xs },
  aiRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  actions: { flexDirection: 'row', alignSelf: 'stretch', justifyContent: 'space-between' },
  action: { flex: 1, alignItems: 'center', gap: spacing.xs, minHeight: 68 },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHigh,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.strokeStrong,
  },
  upgrade: { alignSelf: 'stretch', padding: spacing.lg, gap: spacing.md, backgroundColor: colors.surfaceHigh },
  upgradeBody: { gap: spacing.xs },
});
