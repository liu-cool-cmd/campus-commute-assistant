import { describe, expect, it } from 'vitest';
import type { GtfsFeed } from '../../core/types';
import {
  DUKE_LLCCW_FAMILY_ID,
  migrateDukeHomeTransit,
  resolveDukeTransitSelections,
} from './routeFamilies';

const feed: GtfsFeed = {
  routes: [
    { id: 'TL-13', shortName: 'LLCCW', longName: 'Day', type: 3 },
    { id: 'TL-19', shortName: 'LLCCWN', longName: 'Night', type: 3 },
  ],
  stops: [
    { id: 'TL-190', name: 'Day board', lat: 36, lon: -78.95 },
    { id: 'TL-200', name: 'Day arrive', lat: 36.01, lon: -78.94 },
    { id: 'TL-270', name: 'Day-only timing point', lat: 36.02, lon: -78.94 },
    { id: 'TL-208', name: 'Night board', lat: 36, lon: -78.95 },
    { id: 'TL-216', name: 'Night arrive', lat: 36.01, lon: -78.94 },
    { id: 'TL-269', name: 'Night-only timing point', lat: 36.02, lon: -78.94 },
  ],
  trips: [
    { id: 'day', routeId: 'TL-13', serviceId: 'service' },
    { id: 'night', routeId: 'TL-19', serviceId: 'service' },
  ],
  stopTimes: [
    { tripId: 'day', stopId: 'TL-190', arrivalSeconds: 0, departureSeconds: 0, stopSequence: 1 },
    { tripId: 'day', stopId: 'TL-200', arrivalSeconds: 60, departureSeconds: 60, stopSequence: 2 },
    { tripId: 'day', stopId: 'TL-270', arrivalSeconds: 90, departureSeconds: 90, stopSequence: 3 },
    { tripId: 'night', stopId: 'TL-208', arrivalSeconds: 0, departureSeconds: 0, stopSequence: 1 },
    {
      tripId: 'night',
      stopId: 'TL-216',
      arrivalSeconds: 60,
      departureSeconds: 60,
      stopSequence: 2,
    },
    {
      tripId: 'night',
      stopId: 'TL-269',
      arrivalSeconds: 90,
      departureSeconds: 90,
      stopSequence: 3,
    },
  ],
  frequencies: [],
  calendars: [],
  calendarDates: [],
  shapes: [],
};

describe('Duke route families', () => {
  it('expands a stable LLCCW selection into exact day and night route/stop IDs', () => {
    expect(
      resolveDukeTransitSelections(
        { routeId: 'TL-13', originStopId: 'TL-190', destinationStopId: 'TL-200' },
        feed,
        new Date('2026-08-28T18:00:00-04:00'),
        DUKE_LLCCW_FAMILY_ID,
      ),
    ).toEqual([
      { routeId: 'TL-13', originStopId: 'TL-190', destinationStopId: 'TL-200' },
      { routeId: 'TL-19', originStopId: 'TL-208', destinationStopId: 'TL-216' },
    ]);
  });

  it('does not invent an alias for TL-269 or TL-270', () => {
    expect(
      resolveDukeTransitSelections(
        { routeId: 'TL-13', originStopId: 'TL-190', destinationStopId: 'TL-270' },
        feed,
        new Date('2026-08-28T18:00:00-04:00'),
        DUKE_LLCCW_FAMILY_ID,
      ),
    ).toEqual([{ routeId: 'TL-13', originStopId: 'TL-190', destinationStopId: 'TL-270' }]);
    expect(migrateDukeHomeTransit({ routeId: 'TL-19', originStopId: 'TL-269' })).toEqual({
      routeId: 'TL-19',
      routeFamilyId: DUKE_LLCCW_FAMILY_ID,
      originStopId: 'TL-269',
    });
  });
});
