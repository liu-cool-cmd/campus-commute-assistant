import type { FrequencyEntry, StopTime } from '../types';

export interface TripInstance {
  /** Offset applied to every template stop_time value. */
  timeOffsetSeconds: number;
  frequency?: FrequencyEntry;
}

/**
 * Expands a trip template without changing its GTFS trip_id. The frequencies interval is
 * start-inclusive and end-exclusive. A trip without frequency rows remains one scheduled trip.
 */
export function getTripInstances(
  stopTimes: StopTime[],
  frequencies: FrequencyEntry[],
): TripInstance[] {
  if (frequencies.length === 0) return [{ timeOffsetSeconds: 0 }];
  const firstStop = stopTimes.reduce<StopTime | undefined>(
    (earliest, candidate) =>
      !earliest || candidate.stopSequence < earliest.stopSequence ? candidate : earliest,
    undefined,
  );
  if (!firstStop) return [];

  const instances: TripInstance[] = [];
  for (const frequency of frequencies) {
    for (
      let instanceStart = frequency.startSeconds;
      instanceStart < frequency.endSeconds;
      instanceStart += frequency.headwaySeconds
    ) {
      instances.push({
        timeOffsetSeconds: instanceStart - firstStop.departureSeconds,
        frequency,
      });
    }
  }
  return instances;
}
