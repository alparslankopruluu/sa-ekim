/**
 * Haptics that respect the user's preference and the platform. They fire at the causal
 * moment only (docs/checklists/motion-quality.md). Kök has no UI sounds.
 */
import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { Platform } from 'react-native';

import { useSession } from '@/stores/session';

const hapticsSupported = Platform.OS === 'ios' || Platform.OS === 'android';

export interface Feedback {
  selection(): void;
  tap(): void;
  impact(): void;
  success(): void;
  warning(): void;
  error(): void;
}

export function feedbackFor(prefs: { haptics: boolean }): Feedback {
  const haptic = (fn: () => Promise<void>) => {
    if (prefs.haptics && hapticsSupported) fn().catch(() => undefined);
  };
  return {
    selection: () => haptic(() => Haptics.selectionAsync()),
    tap: () => haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
    impact: () => haptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
    success: () => haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
    warning: () => haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
    error: () => haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  };
}

export function useFeedback(): Feedback {
  const haptics = useSession((s) => s.preferences.haptics);
  return useMemo(() => feedbackFor({ haptics }), [haptics]);
}

/** Non-hook access for worklet callbacks scheduled back onto the JS thread. */
export function currentFeedback(): Feedback {
  return feedbackFor(useSession.getState().preferences);
}
