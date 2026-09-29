/**
 * Haptics + UI sounds that respect the user's preferences and the platform.
 * Haptics fire at the causal moment only (docs/checklists/motion-quality.md).
 */
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { Platform } from 'react-native';

import { UI_SOUNDS, type UiSound } from '@/services/playback';
import { useSession } from '@/stores/session';

const hapticsSupported = Platform.OS === 'ios' || Platform.OS === 'android';

let audioModeSet = false;
const players = new Map<UiSound, ReturnType<typeof createAudioPlayer>>();

function playUiSound(sound: UiSound): void {
  try {
    if (!audioModeSet) {
      audioModeSet = true;
      // UI sounds respect the silent switch (unlike user-initiated playback).
      void setAudioModeAsync({ playsInSilentMode: false }).catch(() => undefined);
    }
    let player = players.get(sound);
    if (!player) {
      player = createAudioPlayer(UI_SOUNDS[sound]);
      player.volume = 0.6;
      players.set(sound, player);
    }
    void player.seekTo(0);
    player.play();
  } catch {
    // Sound effects are decorative; failures are ignored.
  }
}

export interface Feedback {
  selection(): void;
  tap(): void;
  impact(): void;
  success(): void;
  warning(): void;
  error(): void;
  sound(name: UiSound): void;
}

export function feedbackFor(prefs: { haptics: boolean; sounds: boolean }): Feedback {
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
    sound: (name) => {
      if (prefs.sounds) playUiSound(name);
    },
  };
}

export function useFeedback(): Feedback {
  const haptics = useSession((s) => s.preferences.haptics);
  const sounds = useSession((s) => s.preferences.sounds);
  return useMemo(() => feedbackFor({ haptics, sounds }), [haptics, sounds]);
}

/** Non-hook access for worklet callbacks scheduled back onto the JS thread. */
export function currentFeedback(): Feedback {
  return feedbackFor(useSession.getState().preferences);
}
