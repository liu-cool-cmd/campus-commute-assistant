import { describe, expect, it } from 'vitest';
import type { CommuteRecommendation } from '../types';
import { arrivalStatus, buildAlternativeList } from './arrivalStatus';

function departure(id: string, iso: string, minutesEarly = 20): CommuteRecommendation {
  return {
    kind: 'transit',
    leaveAt: new Date(iso),
    originStop: { id: 'o', name: 'Origin', lat: 36, lon: -78.95 },
    destinationStop: { id: 'd', name: 'Destination', lat: 36, lon: -78.94 },
    route: { id: 'c1', shortName: 'C1', longName: 'East-West', type: 3 },
    trip: { id, routeId: 'c1', serviceId: 'weekday' },
    departureTime: new Date(iso),
    departureTimeIsExact: true,
    arrivalTime: new Date(iso),
    walkingMinutes: 0,
    waitingMinutes: 0,
    originWalkingMinutes: 0,
    destinationWalkingMinutes: 0,
    transitMinutes: 0,
    totalMinutes: 0,
    minutesEarly,
    confidence: 'medium',
  };
}

describe('arrivalStatus', () => {
  it('classifies the safety margin against the configured buffer', () => {
    expect(arrivalStatus(12, 10)).toBe('normal');
    expect(arrivalStatus(10, 10)).toBe('normal');
    expect(arrivalStatus(4, 10)).toBe('at-risk');
    expect(arrivalStatus(0, 10)).toBe('at-risk');
    expect(arrivalStatus(-3, 10)).toBe('late');
  });

  it('treats every on-time departure as normal when the buffer is zero', () => {
    expect(arrivalStatus(0, 0)).toBe('normal');
    expect(arrivalStatus(-1, 0)).toBe('late');
  });
});

describe('buildAlternativeList', () => {
  it('orders earlier departures oldest first, then the following departures', () => {
    const earlier = [
      departure('e1', '2026-09-25T12:50:00Z'),
      departure('e2', '2026-09-25T12:40:00Z'),
    ];
    const next = [
      departure('n1', '2026-09-25T13:10:00Z', -5),
      departure('n2', '2026-09-25T13:20:00Z', -15),
    ];
    expect(buildAlternativeList({ earlier, next }).map((entry) => entry.trip.id)).toEqual([
      'e2',
      'e1',
      'n1',
      'n2',
    ]);
  });

  it('caps each side and skips a departure that appears twice', () => {
    const earlier = [
      departure('e1', '2026-09-25T12:50:00Z'),
      departure('e2', '2026-09-25T12:40:00Z'),
      departure('e3', '2026-09-25T12:30:00Z'),
    ];
    const next = [
      departure('e1', '2026-09-25T12:50:00Z', -5),
      departure('n1', '2026-09-25T13:10:00Z', -5),
    ];
    expect(buildAlternativeList({ earlier, next }).map((entry) => entry.trip.id)).toEqual([
      'e2',
      'e1',
      'n1',
    ]);
  });

  it('returns fewer entries when only one side is available', () => {
    expect(
      buildAlternativeList({
        earlier: [],
        next: [departure('n1', '2026-09-25T13:10:00Z', -5)],
      }).map((entry) => entry.trip.id),
    ).toEqual(['n1']);
    expect(buildAlternativeList({ earlier: [], next: [] })).toEqual([]);
  });
});
