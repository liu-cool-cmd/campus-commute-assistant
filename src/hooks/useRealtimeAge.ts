import { useEffect, useState } from 'react';

/**
 * Lightweight UI timer hook that computes the real-time elapsed age in seconds
 * from a reliable recordedAt timestamp.
 *
 * Requirements:
 * - Natural 1-second increment while page is visible.
 * - Pauses and skips updates when page is in background (visibilityState !== 'visible').
 * - Updates immediately upon returning to foreground.
 * - Resets dynamically whenever a fresh snapshot brings a new recordedAt.
 * - Purely for UI freshness display; does not trigger network requests or expensive routing calculations.
 */
export function useRealtimeAge(recordedAt?: Date): number | undefined {
  const [, setTick] = useState(0);
  const recordedTime = recordedAt?.getTime();

  useEffect(() => {
    if (recordedTime === undefined) return;

    const onTick = () => {
      if (document.visibilityState === 'visible') {
        setTick((t) => t + 1);
      }
    };

    const timer = window.setInterval(onTick, 1000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setTick((t) => t + 1);
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [recordedTime]);

  if (recordedTime === undefined) return undefined;

  return Math.max(0, Math.floor((Date.now() - recordedTime) / 1000));
}
