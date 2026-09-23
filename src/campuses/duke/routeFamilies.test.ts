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

  it('restricts night-only stops to the night variant and returns empty if no trips near requested time', () => {
    // Scheduled feed with daytime TL-13 (08:00) and evening TL-19 (19:00)
    const scheduledFeed: GtfsFeed = {
      routes: [
        { id: 'TL-13', shortName: 'LLCCW', longName: 'Day', type: 3 },
        { id: 'TL-19', shortName: 'LLCCWN', longName: 'Night', type: 3 },
      ],
      stops: [
        { id: 'TL-90', name: 'The Heights', lat: 36, lon: -78.95 },
        { id: 'TL-205', name: 'The Heights (Night)', lat: 36, lon: -78.95 },
        { id: 'TL-200', name: 'Duke Clinic (Day)', lat: 36.01, lon: -78.94 },
        { id: 'TL-216', name: 'Duke Clinic (Night)', lat: 36.01, lon: -78.94 },
        { id: 'TL-221', name: 'Erwin at LaSalle (Night Only)', lat: 36.02, lon: -78.94 },
      ],
      trips: [
        { id: 'day-trip', routeId: 'TL-13', serviceId: 'srv' },
        { id: 'night-trip', routeId: 'TL-19', serviceId: 'srv' },
      ],
      stopTimes: [
        {
          tripId: 'day-trip',
          stopId: 'TL-90',
          arrivalSeconds: 8 * 3600,
          departureSeconds: 8 * 3600,
          stopSequence: 1,
        },
        {
          tripId: 'day-trip',
          stopId: 'TL-200',
          arrivalSeconds: 8 * 3600 + 600,
          departureSeconds: 8 * 3600 + 600,
          stopSequence: 2,
        },
        {
          tripId: 'night-trip',
          stopId: 'TL-205',
          arrivalSeconds: 19 * 3600,
          departureSeconds: 19 * 3600,
          stopSequence: 1,
        },
        {
          tripId: 'night-trip',
          stopId: 'TL-216',
          arrivalSeconds: 19 * 3600 + 600,
          departureSeconds: 19 * 3600 + 600,
          stopSequence: 2,
        },
        {
          tripId: 'night-trip',
          stopId: 'TL-221',
          arrivalSeconds: 19 * 3600 + 900,
          departureSeconds: 19 * 3600 + 900,
          stopSequence: 3,
        },
      ],
      frequencies: [],
      calendars: [
        {
          serviceId: 'srv',
          startDate: '2026-08-01',
          endDate: '2026-12-31',
          weekdays: [true, true, true, true, true, true, true],
        },
      ],
      calendarDates: [],
      shapes: [],
    };

    // User selects night-only stop TL-221 at 08:00 (daytime):
    // Should NOT invent trip, should NOT map to day stop, should return empty array
    const morningResult = resolveDukeTransitSelections(
      { routeId: 'TL-13', originStopId: 'TL-205', destinationStopId: 'TL-221' },
      scheduledFeed,
      new Date('2026-09-22T08:00:00-04:00'),
      DUKE_LLCCW_FAMILY_ID,
    );
    expect(morningResult).toEqual([]);

    // User selects night-only stop TL-221 at 19:15 (evening):
    // Should resolve to TL-19 night trip
    const eveningResult = resolveDukeTransitSelections(
      { routeId: 'TL-13', originStopId: 'TL-205', destinationStopId: 'TL-221' },
      scheduledFeed,
      new Date('2026-09-22T19:15:00-04:00'),
      DUKE_LLCCW_FAMILY_ID,
    );
    expect(eveningResult).toEqual([
      { routeId: 'TL-19', originStopId: 'TL-205', destinationStopId: 'TL-221' },
    ]);
  });

  it('uses realtime as a soft ranking signal without dropping scheduled candidates', () => {
    // Both day and night have trips around 18:00
    const transitionFeed: GtfsFeed = {
      routes: [
        { id: 'TL-13', shortName: 'LLCCW', longName: 'Day', type: 3 },
        { id: 'TL-19', shortName: 'LLCCWN', longName: 'Night', type: 3 },
      ],
      stops: [
        { id: 'TL-90', name: 'The Heights', lat: 36, lon: -78.95 },
        { id: 'TL-205', name: 'The Heights (Night)', lat: 36, lon: -78.95 },
        { id: 'TL-200', name: 'Duke Clinic (Day)', lat: 36.01, lon: -78.94 },
        { id: 'TL-216', name: 'Duke Clinic (Night)', lat: 36.01, lon: -78.94 },
      ],
      trips: [
        { id: 'day-18', routeId: 'TL-13', serviceId: 'srv' },
        { id: 'night-18', routeId: 'TL-19', serviceId: 'srv' },
      ],
      stopTimes: [
        {
          tripId: 'day-18',
          stopId: 'TL-90',
          arrivalSeconds: 18 * 3600,
          departureSeconds: 18 * 3600,
          stopSequence: 1,
        },
        {
          tripId: 'day-18',
          stopId: 'TL-200',
          arrivalSeconds: 18 * 3600 + 600,
          departureSeconds: 18 * 3600 + 600,
          stopSequence: 2,
        },
        {
          tripId: 'night-18',
          stopId: 'TL-205',
          arrivalSeconds: 18 * 3600 + 300,
          departureSeconds: 18 * 3600 + 300,
          stopSequence: 1,
        },
        {
          tripId: 'night-18',
          stopId: 'TL-216',
          arrivalSeconds: 18 * 3600 + 900,
          departureSeconds: 18 * 3600 + 900,
          stopSequence: 2,
        },
      ],
      frequencies: [],
      calendars: [
        {
          serviceId: 'srv',
          startDate: '2026-08-01',
          endDate: '2026-12-31',
          weekdays: [true, true, true, true, true, true, true],
        },
      ],
      calendarDates: [],
      shapes: [],
    };

    // 1. Without realtime: both candidates returned
    const withoutRealtime = resolveDukeTransitSelections(
      { routeId: 'TL-13', originStopId: 'TL-90', destinationStopId: 'TL-200' },
      transitionFeed,
      new Date('2026-09-22T18:10:00-04:00'),
      DUKE_LLCCW_FAMILY_ID,
    );
    expect(withoutRealtime).toHaveLength(2);

    // 2. With realtime indicating TL-19 is running: TL-19 ranks first
    const withRealtimeNightActive = resolveDukeTransitSelections(
      { routeId: 'TL-13', originStopId: 'TL-90', destinationStopId: 'TL-200' },
      transitionFeed,
      new Date('2026-09-22T18:10:00-04:00'),
      DUKE_LLCCW_FAMILY_ID,
      {
        receivedAt: new Date('2026-09-22T18:10:00-04:00'),
        vehicles: [],
        routes: [
          {
            routeId: 'TL-19',
            providerRouteId: 'TL-19',
            name: 'LLCCWN',
            isLoop: true,
            polyline: [],
            stops: [],
            isRunning: true,
          },
        ],
      },
    );
    expect(withRealtimeNightActive).toEqual([
      { routeId: 'TL-19', originStopId: 'TL-205', destinationStopId: 'TL-216' },
      { routeId: 'TL-13', originStopId: 'TL-90', destinationStopId: 'TL-200' },
    ]);
  });

  // Loop routes start and end at the same stop. On LL/LLCCW that stop is Duke Clinic
  // (TL-200 day / TL-216 night), so it appears twice in every trip and any boarding stop
  // before the final pass must still reach it.
  const loopFeed: GtfsFeed = {
    routes: [
      { id: 'TL-13', shortName: 'LLCCW', longName: 'Day', type: 3 },
      { id: 'TL-19', shortName: 'LLCCWN', longName: 'Night', type: 3 },
    ],
    stops: [
      { id: 'TL-200', name: 'Research Dr at Duke Clinic (Day)', lat: 36.01, lon: -78.94 },
      { id: 'TL-270', name: 'Circuit Dr timing point (Day)', lat: 36.0, lon: -78.95 },
      { id: 'TL-90', name: 'The Heights at LaSalle (Day)', lat: 36.0, lon: -78.95 },
      { id: 'TL-195', name: 'Circuit Dr at F.E.L. Labs (Day)', lat: 36.0, lon: -78.95 },
      { id: 'TL-216', name: 'Research Dr at Duke Clinic (Night)', lat: 36.01, lon: -78.94 },
      { id: 'TL-212', name: 'Circuit Dr at F.E.L. Labs (Night)', lat: 36.0, lon: -78.95 },
    ],
    trips: [
      { id: 'day-loop', routeId: 'TL-13', serviceId: 'srv' },
      { id: 'night-loop', routeId: 'TL-19', serviceId: 'srv' },
    ],
    stopTimes: [
      // Real TL-13 order: Duke Clinic is the first and the last stop of the loop.
      {
        tripId: 'day-loop',
        stopId: 'TL-200',
        arrivalSeconds: 32_400,
        departureSeconds: 32_400,
        stopSequence: 1,
      },
      {
        tripId: 'day-loop',
        stopId: 'TL-270',
        arrivalSeconds: 32_700,
        departureSeconds: 32_700,
        stopSequence: 2,
      },
      {
        tripId: 'day-loop',
        stopId: 'TL-90',
        arrivalSeconds: 33_000,
        departureSeconds: 33_000,
        stopSequence: 3,
      },
      {
        tripId: 'day-loop',
        stopId: 'TL-90',
        arrivalSeconds: 33_200,
        departureSeconds: 33_200,
        stopSequence: 4,
      },
      {
        tripId: 'day-loop',
        stopId: 'TL-195',
        arrivalSeconds: 33_600,
        departureSeconds: 33_600,
        stopSequence: 5,
      },
      {
        tripId: 'day-loop',
        stopId: 'TL-200',
        arrivalSeconds: 34_200,
        departureSeconds: 34_200,
        stopSequence: 6,
      },
      {
        tripId: 'night-loop',
        stopId: 'TL-212',
        arrivalSeconds: 68_400,
        departureSeconds: 68_400,
        stopSequence: 1,
      },
      {
        tripId: 'night-loop',
        stopId: 'TL-216',
        arrivalSeconds: 69_000,
        departureSeconds: 69_000,
        stopSequence: 2,
      },
    ],
    frequencies: [],
    calendars: [
      {
        serviceId: 'srv',
        startDate: '2026-08-01',
        endDate: '2026-12-31',
        weekdays: [true, true, true, true, true, true, true],
      },
    ],
    calendarDates: [],
    shapes: [],
  };

  it('reaches a loop terminus that is also the first stop of the trip', () => {
    const result = resolveDukeTransitSelections(
      { routeId: 'TL-13', originStopId: 'TL-195', destinationStopId: 'TL-200' },
      loopFeed,
      new Date('2026-09-25T10:00:00-04:00'),
      DUKE_LLCCW_FAMILY_ID,
    );
    expect(result).toEqual([
      { routeId: 'TL-13', originStopId: 'TL-195', destinationStopId: 'TL-200' },
    ]);
  });

  it('still rejects a destination that is upstream of the boarding stop on every pass', () => {
    expect(
      resolveDukeTransitSelections(
        { routeId: 'TL-13', originStopId: 'TL-90', destinationStopId: 'TL-270' },
        loopFeed,
        new Date('2026-09-25T10:00:00-04:00'),
        DUKE_LLCCW_FAMILY_ID,
      ),
    ).toEqual([]);
  });
});
