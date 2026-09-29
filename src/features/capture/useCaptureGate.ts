/**
 * Accelerometer → upright gate for the capture screen. The bubble position lives in shared
 * values (UI thread, no re-render per sample); React state changes only when the gate opens
 * or closes. Deterministic: it never claims to see a face or judge the light.
 */
import { Accelerometer } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import type { Angle } from '@shared/catalog';

import {
  type Gravity,
  isPlausibleReading,
  levelIndicator,
  nextGateState,
  normalizeGravity,
  smoothGravity,
} from '@/lib/captureGate';

const SAMPLE_MS = 80;

export type SensorState = 'checking' | 'available' | 'unavailable';

export function useCaptureGate(angle: Angle, enabled: boolean) {
  const [ok, setOk] = useState(false);
  const [sensor, setSensor] = useState<SensorState>(Platform.OS === 'web' ? 'unavailable' : 'checking');
  const bubbleX = useSharedValue(0);
  const bubbleY = useSharedValue(0);
  const smoothed = useRef<Gravity | null>(null);
  const okRef = useRef(false);

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;
    let cancelled = false;
    let subscription: { remove(): void } | null = null;
    smoothed.current = null;
    okRef.current = false;

    void (async () => {
      const available = await Accelerometer.isAvailableAsync().catch(() => false);
      if (cancelled) return;
      if (!available) {
        setSensor('unavailable');
        return;
      }
      setSensor('available');
      Accelerometer.setUpdateInterval(SAMPLE_MS);
      subscription = Accelerometer.addListener((reading) => {
        const g = normalizeGravity(reading, Platform.OS);
        if (!isPlausibleReading(g)) return;
        const next = smoothGravity(smoothed.current, g);
        smoothed.current = next;
        const level = levelIndicator(angle, next);
        bubbleX.set(level.x);
        bubbleY.set(level.y);
        const open = nextGateState(okRef.current, angle, next);
        if (open !== okRef.current) {
          okRef.current = open;
          setOk(open);
        }
      });
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
      // A new angle or a retake starts closed until fresh samples say otherwise.
      okRef.current = false;
      setOk(false);
    };
  }, [angle, enabled, bubbleX, bubbleY]);

  // Without a motion sensor the gate cannot be checked: it stays open and the UI says so.
  const satisfied = sensor === 'unavailable' ? true : ok;
  return { satisfied, sensor, bubbleX, bubbleY };
}
