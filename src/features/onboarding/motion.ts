import { FadeIn, FadeInDown, FadeInUp, useReducedMotion } from 'react-native-reanimated';

/**
 * Entrance animations that fall back to a plain fade under Reduce Motion (position and
 * scale are the parts that cause discomfort, docs/checklists/motion-quality.md).
 */
export function useEntering(kind: 'up' | 'down' | 'fade', delay = 0) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion || kind === 'fade') return FadeIn.duration(reduceMotion ? 120 : 260).delay(reduceMotion ? 0 : delay);
  return kind === 'up'
    ? FadeInUp.delay(delay).duration(380)
    : FadeInDown.delay(delay).springify().damping(18);
}
