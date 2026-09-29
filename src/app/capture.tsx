/**
 * Capture (spec §4): camera with the ghost overlay of the last same-angle photo, a framing
 * guide, and the upright gate — the shutter only works when the phone is in position.
 *   /capture?angle=<Angle>&mode=journey|preview
 * journey (default): saved to the journey. preview: handed to the preview draft only.
 * Permission denied, no camera, and web all fall back to the library picker.
 */
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  type LayoutChangeEvent,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ANGLES, ANGLES_BY_GOAL, type Angle } from '@shared/catalog';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { PressableScale } from '@/components/PressableScale';
import { showToast } from '@/components/Toast';
import { CloseButton, IconButton } from '@/components/ui';
import { commitJourneyPhoto, commitPreviewPhoto, photoGate, type CaptureSource } from '@/features/capture/commit';
import { fitFrame } from '@/features/capture/guide';
import { GuideOverlay } from '@/features/capture/GuideOverlay';
import { LevelRing } from '@/features/capture/LevelRing';
import { useCaptureGate } from '@/features/capture/useCaptureGate';
import { useWeekLabel } from '@/features/compare/useWeekLabel';
import { useFeedback } from '@/hooks/useFeedback';
import { usePhotoPicker } from '@/hooks/usePhotoPicker';
import { cameraFacingFor, gateModeFor } from '@/lib/captureGate';
import { useEntitlement } from '@/lib/entitlements';
import { track } from '@/services/analytics';
import { recordNonFatal } from '@/services/crash';
import { resolveJourneyUri } from '@/services/journeyFiles';
import { useJourney } from '@/stores/journey';
import { useSession } from '@/stores/session';
import { colors, layout, minTouch, radius, spacing } from '@/theme/tokens';

const GHOST_OPACITY = 0.35;
const SHUTTER = 76;

function isAngle(value: unknown): value is Angle {
  return typeof value === 'string' && (ANGLES as readonly string[]).includes(value);
}

interface Shot {
  uri: string;
  source: CaptureSource;
  takenAt: number;
}

export default function CaptureScreen() {
  const { t } = useTranslation();
  const feedback = useFeedback();
  const reduceMotion = useReducedMotion();
  const focused = useIsFocused();
  const params = useLocalSearchParams<{ angle?: string; mode?: string }>();
  const mode: 'journey' | 'preview' = params.mode === 'preview' ? 'preview' : 'journey';
  const goal = useSession((s) => s.goal) ?? 'hairline';
  const photos = useJourney((s) => s.photos);
  const procedureDate = useJourney((s) => s.procedureDate);
  const { loaded: entitlementLoaded } = useEntitlement();
  const weekLabel = useWeekLabel(procedureDate);
  const { pickFromLibrary } = usePhotoPicker();

  const angles = useMemo<readonly Angle[]>(() => {
    const list = ANGLES_BY_GOAL[goal];
    return isAngle(params.angle) && !list.includes(params.angle) ? [params.angle, ...list] : list;
  }, [goal, params.angle]);
  const [angle, setAngle] = useState<Angle>(() => (isAngle(params.angle) ? params.angle : (angles[0] ?? 'front')));

  const [permission, requestPermission] = useCameraPermissions();
  const [cameraFailed, setCameraFailed] = useState(false);
  const [shot, setShot] = useState<Shot | null>(null);
  const [saving, setSaving] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [showGhost, setShowGhost] = useState(true);
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const cameraRef = useRef<CameraView>(null);
  const blockedTracked = useRef(false);
  const permissionTracked = useRef(false);
  const redirected = useRef(false);

  const web = Platform.OS === 'web';
  const granted = !!permission?.granted;
  const cameraUsable = !web && granted && !cameraFailed;
  const liveCamera = cameraUsable && !shot && focused;
  const gate = useCaptureGate(angle, liveCamera);
  const facing = cameraFacingFor(angle);
  const flat = gateModeFor(angle) === 'flat';

  // Free limit, journey mode: a 4th photo opens the paywall instead of the camera.
  useEffect(() => {
    if (mode !== 'journey' || !entitlementLoaded || redirected.current) return;
    const check = photoGate();
    if (!check.allowed) {
      redirected.current = true;
      track('feature_locked', { feature: 'photos' });
      router.replace({ pathname: '/paywall', params: { source: check.paywallSource ?? 'locked_photos' } });
    }
  }, [mode, entitlementLoaded]);

  // First visit: ask right away (the OS dialog shows the custom purpose string).
  const asked = useRef(false);
  useEffect(() => {
    if (web || !permission || permission.granted || asked.current) return;
    if (permission.status === 'undetermined' && permission.canAskAgain) {
      asked.current = true;
      void requestPermission();
    }
  }, [web, permission, requestPermission]);

  useEffect(() => {
    if (permission && !permission.granted && !permission.canAskAgain && !permissionTracked.current) {
      permissionTracked.current = true;
      track('capture_gate_blocked', { reason: 'permission' });
    }
  }, [permission]);

  // Announce the gate for screen-reader users (the ring is visual only).
  useEffect(() => {
    if (!liveCamera || gate.sensor !== 'available') return;
    if (gate.satisfied) feedback.selection();
    AccessibilityInfo.announceForAccessibility(
      gate.satisfied ? t('capture.level.a11yOk') : flat ? t('capture.level.a11yBlockedFlat') : t('capture.level.a11yBlockedUpright'),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- announce on gate changes only
  }, [gate.satisfied]);

  const ghost = useMemo(() => {
    if (mode !== 'journey') return null;
    const sameAngle = photos.filter((p) => p.angle === angle);
    return sameAngle[sameAngle.length - 1] ?? null;
  }, [mode, photos, angle]);
  const ghostVisible = !!ghost && showGhost;

  const flash = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.get() }));

  const onFrameArea = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setFrame(fitFrame(width, height));
  }, []);

  const takePhoto = async () => {
    if (!gate.satisfied) {
      feedback.warning();
      AccessibilityInfo.announceForAccessibility(flat ? t('capture.shutter.blockedFlat') : t('capture.shutter.blockedUpright'));
      if (!blockedTracked.current) {
        blockedTracked.current = true;
        track('capture_gate_blocked', { reason: 'tilt' });
      }
      return;
    }
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    feedback.impact();
    if (!reduceMotion) flash.set(withSequence(withTiming(0.85, { duration: 60 }), withTiming(0, { duration: 220 })));
    try {
      const picture = await cameraRef.current.takePictureAsync({ quality: 0.92, exif: false, shutterSound: false });
      setShot({ uri: picture.uri, source: 'camera', takenAt: Date.now() });
    } catch (error) {
      recordNonFatal(error, 'capture_take_picture');
      showToast(t('capture.error.capture'), 'error');
    } finally {
      setCapturing(false);
    }
  };

  const fromLibrary = async () => {
    const picked = await pickFromLibrary();
    if (picked) setShot({ uri: picked.uri, source: 'library', takenAt: Date.now() });
  };

  const acceptPhoto = async () => {
    if (!shot || saving) return;
    if (mode === 'preview') {
      commitPreviewPhoto({ uri: shot.uri, angle, goal, source: shot.source });
      router.back();
      return;
    }
    const check = photoGate();
    if (!check.allowed) {
      track('feature_locked', { feature: 'photos' });
      router.replace({ pathname: '/paywall', params: { source: check.paywallSource ?? 'locked_photos' } });
      return;
    }
    setSaving(true);
    try {
      await commitJourneyPhoto({
        uri: shot.uri,
        angle,
        source: shot.source,
        ghost: shot.source === 'camera' && ghostVisible,
        now: new Date(shot.takenAt),
      });
      feedback.success();
      showToast(t('capture.saved'), 'success');
      router.back();
    } catch (error) {
      recordNonFatal(error, 'capture_save');
      showToast(t('capture.error.save'), 'error');
      setSaving(false);
    }
  };

  const angleLabel = t(`capture.angle.${angle}`);

  const angleChips = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {angles.map((a) => (
        <Chip
          key={a}
          label={t(`capture.angle.${a}`)}
          selected={a === angle}
          onPress={() => setAngle(a)}
          testID={`angle-${a}`}
        />
      ))}
    </ScrollView>
  );

  const header = (
    <View style={styles.top}>
      <AppText variant="title2" accessibilityRole="header" style={styles.flex}>
        {t('capture.title')}
      </AppText>
      <CloseButton onPress={() => router.back()} testID="capture-close" />
    </View>
  );

  // ---------------------------------------------------------------- review
  if (shot) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        {header}
        <View style={styles.frameArea} onLayout={onFrameArea}>
          <View style={[styles.frame, { width: frame.width, height: frame.height }]}>
            <Image
              source={{ uri: shot.uri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              accessible
              accessibilityLabel={t('capture.review.a11y')}
            />
          </View>
        </View>
        <View style={styles.bottom}>
          <AppText variant="callout" color="textSecondary" align="center">
            {mode === 'preview'
              ? t('capture.review.previewOnly')
              : t('capture.review.caption', { angle: angleLabel, label: weekLabel(shot.takenAt) })}
          </AppText>
          <View style={styles.reviewRow}>
            <Button
              label={t('capture.review.retake')}
              variant="secondary"
              icon="refresh"
              onPress={() => setShot(null)}
              disabled={saving}
              style={styles.flex}
              testID="capture-retake"
            />
            <Button
              label={saving ? t('capture.review.saving') : t('capture.review.use')}
              onPress={() => void acceptPhoto()}
              loading={saving}
              style={styles.flex}
              testID="capture-use"
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------- fallbacks (no camera)
  if (web || cameraFailed || (permission && !permission.granted && permission.status !== 'undetermined')) {
    const denied = !web && !cameraFailed;
    const canAsk = !!permission?.canAskAgain;
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        {header}
        <View style={styles.fallback}>
          <AppText variant="title2" align="center">
            {denied ? t('capture.permission.title') : t('capture.unavailable.title')}
          </AppText>
          <AppText variant="body" color="textSecondary" align="center">
            {denied ? t('capture.permission.body') : t('capture.unavailable.body')}
          </AppText>
          {angleChips}
          <AppText variant="caption" color="textTertiary" align="center">
            {t(`capture.instruction.${angle}`)}
          </AppText>
          {denied ? (
            <Button
              label={canAsk ? t('capture.permission.allow') : t('capture.permission.settings')}
              icon="camera-outline"
              onPress={() => void (canAsk ? requestPermission() : Linking.openSettings())}
              testID="capture-permission"
            />
          ) : null}
          <Button
            label={t('capture.library')}
            icon="images-outline"
            variant={denied ? 'secondary' : 'primary'}
            onPress={() => void fromLibrary()}
            testID="capture-library"
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission || !permission.granted) {
    return (
      <SafeAreaView style={[styles.root, styles.center]} edges={['top', 'bottom']}>
        <ActivityIndicator color={colors.primary} />
        <AppText variant="callout" color="textSecondary">
          {t('capture.permission.checking')}
        </AppText>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------- camera
  const levelText =
    gate.sensor === 'unavailable'
      ? t('capture.level.unavailable')
      : gate.satisfied
        ? t('capture.level.ok')
        : flat
          ? t('capture.level.flat')
          : t('capture.level.upright');

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {header}
      {angleChips}
      <AppText variant="callout" color="textSecondary" style={styles.instruction}>
        {t(`capture.instruction.${angle}`)}
      </AppText>

      <View style={styles.frameArea} onLayout={onFrameArea}>
        <View
          style={[styles.frame, { width: frame.width, height: frame.height }]}
          accessible
          accessibilityLabel={t('capture.guide.frame')}
        >
          {frame.width > 0 ? (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing={facing}
              mode="picture"
              ratio="4:3"
              animateShutter={false}
              active={liveCamera}
              onMountError={() => setCameraFailed(true)}
            />
          ) : null}
          {ghostVisible && ghost ? (
            <Image
              source={{ uri: resolveJourneyUri(ghost.uri) }}
              // The front-camera preview is mirrored; mirror the ghost so it lines up.
              style={[StyleSheet.absoluteFill, { opacity: GHOST_OPACITY }, facing === 'front' && styles.mirrored]}
              contentFit="cover"
              accessible={false}
            />
          ) : null}
          {frame.width > 0 ? (
            <GuideOverlay angle={angle} width={frame.width} height={frame.height} ok={gate.satisfied} />
          ) : null}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} />
          {ghost ? (
            <IconButton
              icon={showGhost ? 'layers' : 'layers-outline'}
              label={showGhost ? t('capture.guide.ghostHide') : t('capture.guide.ghostShow')}
              onPress={() => setShowGhost((v) => !v)}
              style={styles.ghostToggle}
              testID="capture-ghost-toggle"
            />
          ) : null}
        </View>
      </View>

      <View style={styles.bottom}>
        <AppText variant="caption" color="textTertiary" align="center">
          {t(facing === 'front' ? 'capture.cameraNote.front' : 'capture.cameraNote.back')}
        </AppText>
        <View style={styles.controls}>
          <View style={styles.side}>
            <IconButton icon="images-outline" label={t('capture.library')} onPress={() => void fromLibrary()} testID="capture-library" />
          </View>
          <PressableScale
            onPress={() => void takePhoto()}
            haptic="none"
            accessibilityLabel={t('capture.shutter.label')}
            accessibilityHint={
              gate.satisfied ? undefined : flat ? t('capture.shutter.blockedFlat') : t('capture.shutter.blockedUpright')
            }
            accessibilityState={{ disabled: !gate.satisfied, busy: capturing }}
            style={[styles.shutter, { borderColor: gate.satisfied ? colors.sage : colors.strokeStrong }]}
            testID="capture-shutter"
          >
            <View style={[styles.shutterInner, !gate.satisfied && styles.shutterBlocked]} />
          </PressableScale>
          <View style={styles.side}>
            {gate.sensor === 'available' ? <LevelRing x={gate.bubbleX} y={gate.bubbleY} ok={gate.satisfied} /> : null}
          </View>
        </View>
        <AppText
          variant="callout"
          color={gate.satisfied ? 'sage' : 'textSecondary'}
          align="center"
          accessibilityLiveRegion="polite"
        >
          {gate.satisfied || gate.sensor === 'unavailable'
            ? levelText
            : flat
              ? t('capture.shutter.blockedFlat')
              : t('capture.shutter.blockedUpright')}
        </AppText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  flex: { flex: 1 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  chips: { gap: spacing.sm, paddingHorizontal: layout.screenPadding, paddingVertical: spacing.xs },
  instruction: { paddingHorizontal: layout.screenPadding, paddingTop: spacing.sm },
  frameArea: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  frame: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.strokeStrong,
  },
  mirrored: { transform: [{ scaleX: -1 }] },
  flash: { backgroundColor: colors.text },
  ghostToggle: { position: 'absolute', top: spacing.sm, end: spacing.sm, backgroundColor: colors.scrim },
  bottom: { paddingHorizontal: layout.screenPadding, paddingBottom: spacing.lg, gap: spacing.md },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  side: { width: minTouch + 20, alignItems: 'center' },
  shutter: {
    width: SHUTTER,
    height: SHUTTER,
    borderRadius: SHUTTER / 2,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: SHUTTER - 16, height: SHUTTER - 16, borderRadius: (SHUTTER - 16) / 2, backgroundColor: colors.text },
  shutterBlocked: { opacity: 0.35 },
  reviewRow: { flexDirection: 'row', gap: spacing.md },
  fallback: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: layout.screenPadding,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
});
