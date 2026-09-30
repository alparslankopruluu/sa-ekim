import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { colors, glows, radius, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

type Tone = 'success' | 'error' | 'info';

interface ToastState {
  message: string | null;
  tone: Tone;
  id: number;
  show(message: string, tone?: Tone): void;
  hide(): void;
}

export const useToast = create<ToastState>()((set, get) => ({
  message: null,
  tone: 'info',
  id: 0,
  show: (message, tone = 'info') => set({ message, tone, id: get().id + 1 }),
  hide: () => set({ message: null }),
}));

export function showToast(message: string, tone: Tone = 'info'): void {
  useToast.getState().show(message, tone);
  AccessibilityInfo.announceForAccessibility(message);
}

const ICONS: Record<Tone, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'sparkles',
};

const TONE_COLOR: Record<Tone, string> = {
  success: colors.success,
  error: colors.danger,
  info: colors.accent,
};

/** Global, non-blocking status message. Auto-hides; tap to dismiss early. */
export function ToastHost() {
  const insets = useSafeAreaInsets();
  const { message, tone, id, hide } = useToast();

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(hide, 3200);
    return () => clearTimeout(timer);
  }, [hide, id, message]);

  if (!message) return null;

  return (
    <Animated.View
      key={id}
      entering={FadeInUp.springify().damping(18)}
      exiting={FadeOutUp.duration(160)}
      style={[styles.wrap, { top: insets.top + spacing.sm }]}
      pointerEvents="box-none"
    >
      <PressableScale onPress={hide} style={styles.toast} accessibilityRole="alert" accessibilityLabel={message}>
        <Ionicons name={ICONS[tone]} size={20} color={TONE_COLOR[tone]} />
        <AppText variant="callout" style={styles.text}>
          {message}
        </AppText>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
    zIndex: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceHigh,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.strokeStrong,
    boxShadow: glows.soft,
    maxWidth: 520,
  },
  text: { flexShrink: 1 },
});
