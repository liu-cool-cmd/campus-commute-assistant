import type { LiveTripProgress } from './routeProgress';

export const DEFAULT_FALLBACK_MAX_AGE_SECONDS = 40;

/**
 * Fallback resolver that retains the last known good vehicle progress during
 * transient matching ambiguity or momentary unavailability.
 *
 * Requirements:
 * 1. When current progress is reliable ('live' or 'stale' with active vehicle), return current.
 * 2. When current is transiently 'unavailable' or 'ambiguous':
 *    - If lastKnownGood exists for the exact same trip (routeId, boardingStopId, arrivalStopId)
 *    - And observation age (now - vehicle.recordedAt) is within maxFallbackAgeSeconds:
 *    - Return lastKnownGood with status: 'stale', reason: 'stale-gps', isFallback: true.
 *    - Do NOT extrapolate or fake coordinates.
 * 3. When observation age exceeds maxFallbackAgeSeconds, fallback expires and current is returned.
 * 4. When route or stops change, previous fallback is invalidated.
 */
export function applyLiveTripFallback(
  current: LiveTripProgress,
  lastKnownGood: LiveTripProgress | undefined,
  now: Date,
  maxFallbackAgeSeconds: number = DEFAULT_FALLBACK_MAX_AGE_SECONDS,
): { progress: LiveTripProgress; nextLastKnownGood: LiveTripProgress | undefined } {
  // If current progress has an active, matched vehicle and is reliable ('live' or 'stale'):
  if (
    (current.status === 'live' || current.status === 'stale') &&
    current.vehicle &&
    !current.isFallback
  ) {
    return {
      progress: current,
      nextLastKnownGood: current,
    };
  }

  // Current is unavailable or ambiguous: check if we can safely fallback to lastKnownGood
  if (lastKnownGood?.vehicle && lastKnownGood.route && current.route) {
    const sameTrip =
      lastKnownGood.route.routeId === current.route.routeId &&
      lastKnownGood.boardingStop?.id === current.boardingStop?.id &&
      lastKnownGood.arrivalStop?.id === current.arrivalStop?.id;

    if (sameTrip) {
      const observationAgeSeconds = Math.max(
        0,
        Math.floor((now.getTime() - lastKnownGood.vehicle.recordedAt.getTime()) / 1000),
      );

      if (observationAgeSeconds <= maxFallbackAgeSeconds) {
        return {
          progress: {
            ...lastKnownGood,
            status: 'stale',
            reason: 'stale-gps',
            isFallback: true,
            gpsAgeSeconds: observationAgeSeconds,
          },
          nextLastKnownGood: lastKnownGood,
        };
      }
    }
  }

  // Fallback expired or trip changed
  return {
    progress: current,
    nextLastKnownGood: undefined,
  };
}
