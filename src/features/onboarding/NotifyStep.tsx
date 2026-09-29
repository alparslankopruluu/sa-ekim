import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { track } from '@/services/analytics';
import { requestPermission } from '@/services/notifications';
import { colors, glows, radius, spacing } from '@/theme/tokens';

import { useEntering } from './motion';
import { StepScaffold } from './StepScaffold';

const BULLETS = [
  { icon: 'swap-horizontal-outline', key: 'onboarding.notify.bulletPhase' },
  { icon: 'camera-outline', key: 'onboarding.notify.bulletPhoto' },
  { icon: 'medkit-outline', key: 'onboarding.notify.bulletCare' },
] as const;

/** Custom priming before the single system dialog (docs/playbooks/onboarding.md). */
export function NotifyStep({ onNext, onGranted }: { onNext: () => void; onGranted?: () => void }) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const swing = useSharedValue(0);
  const glow = useSharedValue(0);
  const [busy, setBusy] = useState(false);
  const header = useEntering('up');

  useEffect(() => {
    track('notification_prime_view', { source: 'onboarding' });
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    swing.set(
      withRepeat(
        withSequence(
          withDelay(900, withTiming(1, { duration: 120 })),
          withTiming(-1, { duration: 160 }),
          withTiming(0.6, { duration: 140 }),
          withTiming(-0.4, { duration: 120 }),
          withTiming(0, { duration: 120 }),
        ),
        -1,
      ),
    );
    glow.set(withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => {
      cancelAnimation(swing);
      cancelAnimation(glow);
    };
  }, [glow, reduceMotion, swing]);

  const bellStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${swing.value * 18}deg` }] }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? 0.35 : 0.18 + glow.value * 0.32,
    transform: [{ scale: reduceMotion ? 1.1 : 1 + glow.value * 0.22 }],
  }));

  const allow = async () => {
    if (busy) return;
    setBusy(true);
    const granted = await requestPermission('onboarding').catch(() => false);
    // `requestPermission` registers the push token and builds the journey reminders on a grant.
    if (granted) onGranted?.();
    setBusy(false);
    onNext();
  };

  return (
    <StepScaffold
      contentStyle={styles.center}
      footer={
        <>
          <Button label={t('onboarding.notify.allow')} onPress={() => void allow()} loading={busy} shine testID="notify-allow" />
          <Button label={t('onboarding.notify.skip')} onPress={onNext} variant="ghost" size="md" disabled={busy} testID="notify-skip" />
          <AppText variant="caption" color="textTertiary" align="center">
            {t('onboarding.notify.note')}
          </AppText>
        </>
      }
    >
      <View style={styles.bellWrap} accessibilityElementsHidden importantForAccessibility="no">
        <Animated.View style={[styles.halo, glowStyle]} />
        <Animated.View style={[styles.bell, bellStyle]}>
          <Ionicons name="notifications" size={52} color={colors.textOnAccent} />
        </Animated.View>
      </View>
      <Animated.View entering={header} style={styles.header}>
        <AppText variant="title1" align="center" accessibilityRole="header">
          {t('onboarding.notify.title')}
        </AppText>
        <AppText variant="body" color="textSecondary" align="center">
          {t('onboarding.notify.subtitle')}
        </AppText>
      </Animated.View>
      <View style={styles.bullets}>
        {BULLETS.map((bullet) => (
          <View key={bullet.key} style={styles.bullet}>
            <View style={styles.bulletIcon}>
              <Ionicons name={bullet.icon} size={18} color={colors.accent} />
            </View>
            <AppText variant="bodyStrong" style={styles.bulletText}>
              {t(bullet.key)}
            </AppText>
          </View>
        ))}
      </View>
    </StepScaffold>
  );
}

const BELL = 104;

const styles = StyleSheet.create({
  center: { justifyContent: 'center', gap: spacing.xl },
  bellWrap: { alignSelf: 'center', width: BELL + 48, height: BELL + 48, alignItems: 'center', justifyContent: 'center' },
  halo: {
    position: 'absolute',
    width: BELL + 40,
    height: BELL + 40,
    borderRadius: (BELL + 40) / 2,
    backgroundColor: colors.primary,
  },
  bell: {
    width: BELL,
    height: BELL,
    borderRadius: BELL / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    boxShadow: glows.primary,
  },
  header: { gap: spacing.sm },
  bullets: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.stroke,
  },
  bullet: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bulletText: { flex: 1 },
  bulletIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceHigh,
  },
});
