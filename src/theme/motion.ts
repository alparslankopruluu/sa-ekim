/**
 * Motion personality: playful on reveals (first result, reward, paywall entrance),
 * crisp and quick everywhere else. Repeated actions stay near-instant
 * (docs/checklists/motion-quality.md). Reduce Motion swaps position/scale for fades.
 */
import { Easing } from 'react-native-reanimated';

export const springs = {
  /** Press feedback, toggles, chips. */
  snappy: { damping: 18, stiffness: 320, mass: 0.8 },
  /** Cards and sheets settling into place. */
  settle: { damping: 20, stiffness: 180, mass: 1 },
  /** Rare delight moments only (reward reveal, first result). */
  bouncy: { damping: 11, stiffness: 170, mass: 0.9 },
} as const;

export const durations = {
  instant: 90,
  fast: 160,
  base: 240,
  slow: 420,
  reveal: 700,
  ambient: 5200,
} as const;

export const easings = {
  standard: Easing.bezier(0.2, 0, 0, 1),
  exit: Easing.bezier(0.4, 0, 1, 1),
  /** Wheel spin: long, decisive deceleration. */
  spin: Easing.bezier(0.12, 0.82, 0.12, 1),
} as const;

export const stagger = (index: number, step = 60) => index * step;
