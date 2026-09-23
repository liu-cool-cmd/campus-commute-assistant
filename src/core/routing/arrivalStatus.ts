import type { CommuteRecommendation } from '../types';

/**
 * `at-risk` arrives before the bell but without the configured safety margin; `late` arrives after
 * the bell. Only departures after the recommendation can be either, since the recommendation is
 * already the latest departure that still satisfies the buffer.
 */
export type ArrivalStatus = 'normal' | 'at-risk' | 'late';

export function arrivalStatus(minutesEarly: number, bufferMinutes: number): ArrivalStatus {
  if (minutesEarly < 0) return 'late';
  return minutesEarly < bufferMinutes ? 'at-risk' : 'normal';
}

export interface AlternativeListInput {
  /** Departures before the recommendation, newest first. */
  earlier: CommuteRecommendation[];
  /** Departures after the recommendation, nearest first. */
  next: CommuteRecommendation[];
  earlierCount?: number;
  nextCount?: number;
}

function departureKey(recommendation: CommuteRecommendation): string {
  return [
    recommendation.route.id,
    recommendation.originStop.id,
    recommendation.destinationStop.id,
    recommendation.departureTime.toISOString(),
  ].join(':');
}

/**
 * A single time-ordered list: earlier departures oldest first, then the following departures. The
 * recommendation itself is shown on its own, so it is not part of this list.
 */
export function buildAlternativeList({
  earlier,
  next,
  earlierCount = 2,
  nextCount = 2,
}: AlternativeListInput): CommuteRecommendation[] {
  const seen = new Set<string>();
  const list: CommuteRecommendation[] = [];
  const candidates = [...earlier.slice(0, earlierCount).reverse(), ...next.slice(0, nextCount)];
  for (const recommendation of candidates) {
    const key = departureKey(recommendation);
    if (seen.has(key)) continue;
    seen.add(key);
    list.push(recommendation);
  }
  return list;
}
