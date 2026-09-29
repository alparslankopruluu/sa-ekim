import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

import { AppText, type AppTextProps } from './AppText';

export interface AnimatedNumberProps extends Omit<AppTextProps, 'children'> {
  value: number;
  format?: (value: number) => string;
  durationMs?: number;
}

/** Counts from the previous value to the new one (credits, prices). JS-driven but cheap: ≤ 24 renders. */
export function AnimatedNumber({ value, format, durationMs = 600, ...textProps }: AnimatedNumberProps) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    fromRef.current = value;
    if (reduceMotion || from === value) {
      setDisplay(value);
      return;
    }
    const steps = 24;
    let step = 0;
    const timer = setInterval(() => {
      step += 1;
      const eased = 1 - Math.pow(1 - step / steps, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (step >= steps) clearInterval(timer);
    }, durationMs / steps);
    return () => clearInterval(timer);
  }, [durationMs, reduceMotion, value]);

  return <AppText {...textProps}>{format ? format(display) : String(display)}</AppText>;
}
