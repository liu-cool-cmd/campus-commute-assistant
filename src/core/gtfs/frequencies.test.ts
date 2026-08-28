import { describe, expect, it } from 'vitest';
import type { FrequencyEntry, StopTime } from '../types';
import { getTripInstances } from './frequencies';

const stopTimes: StopTime[] = [
  {
    tripId: 'trip-as-provided',
    stopId: 'first',
    arrivalSeconds: 300,
    departureSeconds: 600,
    stopSequence: 1,
  },
  {
    tripId: 'trip-as-provided',
    stopId: 'second',
    arrivalSeconds: 1_200,
    departureSeconds: 1_200,
    stopSequence: 2,
  },
];

describe('getTripInstances', () => {
  it('keeps a scheduled trip as one unshifted instance', () => {
    expect(getTripInstances(stopTimes, [])).toEqual([{ timeOffsetSeconds: 0 }]);
  });

  it('expands start-inclusive, end-exclusive headway instances from first-stop departure', () => {
    const frequency: FrequencyEntry = {
      tripId: 'trip-as-provided',
      startSeconds: 3_600,
      endSeconds: 5_400,
      headwaySeconds: 600,
      exactTimes: 1,
    };

    const instances = getTripInstances(stopTimes, [frequency]);
    expect(instances.map((instance) => instance.timeOffsetSeconds)).toEqual([3_000, 3_600, 4_200]);
    expect(instances.every((instance) => instance.frequency?.tripId === 'trip-as-provided')).toBe(
      true,
    );
  });
});
