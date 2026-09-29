import { useCallback, useEffect, useRef } from 'react';

/** Delay that lets the selection animation land before a single-tap question advances. */
export const AUTO_ADVANCE_MS = 380;

/**
 * Advance after a single-tap answer. A second tap restarts the timer (so changing your mind
 * within the delay never double-advances) and leaving the screen cancels it.
 */
export function useAutoAdvance(onAdvance: () => void, delay = AUTO_ADVANCE_MS) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(onAdvance);

  useEffect(() => {
    latest.current = onAdvance;
  }, [onAdvance]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      latest.current();
    }, delay);
  }, [delay]);
}
