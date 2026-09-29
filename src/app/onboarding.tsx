/**
 * Onboarding (spec §6, docs/playbooks/onboarding.md): welcome → goal → stage → date →
 * photo → consent → notify → crafting (real preview) → reveal → paywall. One screen, animated
 * step transitions; the order and skip rules live in features/onboarding/flow.ts.
 */
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, I18nManager, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInLeft,
  SlideInRight,
  SlideOutLeft,
  SlideOutRight,
  useReducedMotion,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StageBackground } from '@/components/StageBackground';
import { StepProgress } from '@/components/StepProgress';
import { IconButton } from '@/components/ui';
import { ConsentStep } from '@/features/onboarding/ConsentStep';
import { CraftingStep } from '@/features/onboarding/CraftingStep';
import { DateStep } from '@/features/onboarding/DateStep';
import {
  type FlowContext,
  type FlowTarget,
  isBackable,
  nextStep,
  previousStep,
  progressPosition,
  STEP_IDS,
  type StepId,
} from '@/features/onboarding/flow';
import { GoalStep } from '@/features/onboarding/GoalStep';
import { NotifyStep } from '@/features/onboarding/NotifyStep';
import { PhotoStep } from '@/features/onboarding/PhotoStep';
import { RevealStep } from '@/features/onboarding/RevealStep';
import { StageStep } from '@/features/onboarding/StageStep';
import { usePreviewRender } from '@/features/onboarding/usePreviewRender';
import { WelcomeStep } from '@/features/onboarding/WelcomeStep';
import { setUserProperty, track, trackOnboardingStep } from '@/services/analytics';
import { recordNonFatal } from '@/services/crash';
import { hasConsent } from '@/services/generation';
import { getPermissionState, type PermissionState, scheduleJourneyReminders } from '@/services/notifications';
import { purchases } from '@/services/purchases';
import { remoteFlag, remoteString } from '@/services/remoteConfig';
import { useAccount } from '@/stores/account';
import { usePreviewDraft } from '@/stores/previewDraft';
import { useSession } from '@/stores/session';
import { colors, layout, spacing } from '@/theme/tokens';

interface FlowState {
  photo: FlowContext['photo'];
  consentDeclined: boolean;
}

const INITIAL_FLOW: FlowState = { photo: 'unknown', consentDeclined: false };

export default function Onboarding() {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState<StepId>('welcome');
  const [direction, setDirection] = useState<1 | -1>(1);
  const [flow, setFlow] = useState<FlowState>(INITIAL_FLOW);
  const flowRef = useRef<FlowState>(INITIAL_FLOW);
  const stepRef = useRef<StepId>('welcome');
  const permission = useRef<PermissionState>('undetermined');
  const consentGivenAtStart = useRef(hasConsent());
  const startedAt = useRef(Date.now());
  const finished = useRef(false);
  const remindersScheduled = useRef(false);
  const preview = usePreviewRender();
  const { start: startPreview, retry: retryPreview } = preview;

  const stage = useSession((s) => s.stage);
  const goal = useSession((s) => s.goal);
  const previewUsed = useAccount((s) => s.wallet.previewUsed);
  const previewEnabled = remoteFlag('ff_onboarding_preview') && !previewUsed;

  const buildContext = useCallback(
    (patch: Partial<FlowState> = {}): FlowContext => {
      const merged = { ...flowRef.current, ...patch };
      return {
        stage: useSession.getState().stage,
        photo: merged.photo,
        consentGivenAtStart: consentGivenAtStart.current,
        consentDeclined: merged.consentDeclined,
        notifyDecided: permission.current !== 'undetermined',
        previewEnabled: remoteFlag('ff_onboarding_preview') && !useAccount.getState().wallet.previewUsed,
      };
    },
    [],
  );

  const updateFlow = useCallback((patch: Partial<FlowState>) => {
    flowRef.current = { ...flowRef.current, ...patch };
    setFlow(flowRef.current);
  }, []);

  useEffect(() => {
    const variant = remoteString('onboarding_variant');
    useSession.getState().startOnboarding();
    track('onboarding_start', { variant });
    setUserProperty('onboarding_variant', variant);
    // Paywall must render instantly at the end (docs/playbooks/paywall.md).
    purchases.prefetch();
    void getPermissionState()
      .then((state) => {
        permission.current = state;
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    stepRef.current = step;
    trackOnboardingStep(STEP_IDS.indexOf(step) + 1, step);
  }, [step]);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    const session = useSession.getState();
    session.completeOnboarding();
    const goal = session.goal ?? 'none';
    const stageName = session.stage ?? 'none';
    setUserProperty('goal', goal);
    setUserProperty('journey_stage', stageName);
    track('onboarding_complete', {
      duration_s: Math.round((Date.now() - startedAt.current) / 1000),
      goal,
      stage: stageName,
    });
    // Notification priming was skipped because the permission was already granted: still schedule.
    if (!remindersScheduled.current && permission.current === 'granted') {
      scheduleJourneyReminders().catch((error: unknown) => recordNonFatal(error, 'onboarding_reminders'));
    }
    usePreviewDraft.getState().reset();
    router.replace('/(tabs)');
    router.push({ pathname: '/paywall', params: { source: 'onboarding' } });
  }, []);

  const goTo = useCallback(
    (target: FlowTarget, dir: 1 | -1) => {
      if (target === 'finish') {
        finish();
        return;
      }
      setDirection(dir);
      setStep(target);
    },
    [finish],
  );

  const advance = useCallback(
    (patch: Partial<FlowState> = {}) => {
      const from = stepRef.current;
      const ctx = buildContext(patch);
      updateFlow(patch);
      // Consent exists and the photo is chosen: start the real preview now, so the render
      // hides behind the notification priming.
      const draft = usePreviewDraft.getState();
      const wantsPreview =
        (from === 'photo' || from === 'consent') &&
        ctx.photo === 'present' &&
        !ctx.consentDeclined &&
        ctx.previewEnabled &&
        hasConsent();
      if (wantsPreview && draft.photo && draft.goal) void startPreview({ photo: draft.photo, goal: draft.goal });
      goTo(nextStep(from, ctx), 1);
    },
    [buildContext, goTo, startPreview, updateFlow],
  );

  const back = useCallback(() => {
    const from = stepRef.current;
    if (!isBackable(from)) return;
    const target = previousStep(from, buildContext());
    if (!target) return;
    updateFlow(INITIAL_FLOW);
    goTo(target, -1);
  }, [buildContext, goTo, updateFlow]);

  // Android hardware back: step back where allowed, never leave onboarding.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => subscription.remove();
  }, [back]);

  const advanceNext = useCallback(() => advance(), [advance]);

  const onGranted = useCallback(() => {
    remindersScheduled.current = true;
    permission.current = 'granted';
  }, []);

  const onNotifyDone = useCallback(() => {
    // Whatever the user chose, the system dialog is not asked again during onboarding.
    void getPermissionState()
      .then((state) => {
        permission.current = state;
      })
      .catch(() => undefined);
    advance();
  }, [advance]);

  const ctx = buildContext();
  const position = progressPosition(step, {
    ...ctx,
    stage,
    photo: flow.photo,
    consentDeclined: flow.consentDeclined,
    previewEnabled,
  });
  const draftPhoto = usePreviewDraft((s) => s.photo);

  const forward = I18nManager.isRTL ? -direction : direction;
  const entering = reduceMotion ? FadeIn : forward > 0 ? SlideInRight.springify().damping(22) : SlideInLeft.springify().damping(22);
  const exiting = reduceMotion ? FadeOut : forward > 0 ? SlideOutLeft.duration(220) : SlideOutRight.duration(220);

  const showChrome = step !== 'welcome' && step !== 'reveal';

  return (
    <View style={styles.root}>
      <StageBackground animated={step === 'welcome' || step === 'crafting'} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          {isBackable(step) ? (
            <IconButton
              icon={I18nManager.isRTL ? 'chevron-forward' : 'chevron-back'}
              onPress={back}
              label={t('common.back')}
              testID="onboarding-back"
            />
          ) : (
            <View style={styles.topSpacer} />
          )}
          {showChrome ? (
            <View style={styles.progress}>
              <StepProgress current={position.index} total={position.total} />
            </View>
          ) : (
            <View style={styles.progress} />
          )}
          <View style={styles.topSpacer} />
        </View>

        <Animated.View key={step} entering={entering} exiting={exiting} style={styles.content}>
          {step === 'welcome' ? <WelcomeStep onNext={() => advance()} /> : null}
          {step === 'goal' ? <GoalStep onNext={() => advance()} /> : null}
          {step === 'stage' ? <StageStep onNext={() => advance()} /> : null}
          {step === 'date' ? <DateStep onNext={() => advance()} /> : null}
          {step === 'photo' ? (
            <PhotoStep onContinue={() => advance({ photo: 'present' })} onSkip={() => advance({ photo: 'skipped' })} />
          ) : null}
          {step === 'consent' ? (
            <ConsentStep onAccepted={() => advance()} onDeclined={() => advance({ consentDeclined: true })} />
          ) : null}
          {step === 'notify' ? <NotifyStep onNext={onNotifyDone} onGranted={onGranted} /> : null}
          {step === 'crafting' ? (
            <CraftingStep
              phase={preview.phase}
              stage={preview.stage}
              progress={preview.progress}
              errorCode={preview.errorCode}
              goal={goal}
              photoUri={draftPhoto?.localUri ?? null}
              onReady={advanceNext}
              onSkip={finish}
              onRetry={retryPreview}
            />
          ) : null}
          {step === 'reveal' ? (
            <RevealStep preview={preview.preview} photoUri={draftPhoto?.localUri ?? null} onDone={finish} />
          ) : null}
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1, paddingHorizontal: layout.screenPadding },
  topBar: { height: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  topSpacer: { width: 44 },
  progress: { flex: 1 },
  content: { flex: 1, width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' },
});
