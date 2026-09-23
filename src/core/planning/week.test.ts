import { describe, expect, it } from 'vitest';
import type { ClassEvent, GtfsFeed, UserSettings } from '../types';
import { classBindingKey } from '../calendar/bindings';
import { buildWeekPlans, getUpcomingWindowEvents } from './week';

const event = (id: string, startTime: string): ClassEvent => ({
  id,
  title: id,
  startTime: new Date(startTime),
  endTime: new Date(new Date(startTime).getTime() + 60 * 60_000),
  location: 'CIEMAS 2240',
});

describe('getUpcomingWindowEvents', () => {
  it('returns future events in the next seven days in chronological order', () => {
    const now = new Date('2026-08-27T12:00:00-04:00');
    const result = getUpcomingWindowEvents(
      [
        event('day-six', '2026-09-02T09:00:00-04:00'),
        event('past', '2026-08-27T09:00:00-04:00'),
        event('today', '2026-08-27T15:00:00-04:00'),
        event('too-late', '2026-09-04T09:00:00-04:00'),
      ],
      now,
    );

    expect(result.map(({ id }) => id)).toEqual(['today', 'day-six']);
  });

  it('excludes events beyond the requested calendar-day window', () => {
    const now = new Date('2026-08-27T12:00:00Z');
    const inside = event('inside', '2026-08-28T11:30:00Z');
    const outside = event('outside', '2026-08-28T12:30:00Z');

    expect(getUpcomingWindowEvents([inside, outside], now, 1).map(({ id }) => id)).toEqual([
      'inside',
    ]);
  });
});

// Duke Clinic is the first and last stop of the LLCCW loop, so the same stop id occurs twice
// in one trip. Week plans must resolve it instead of reporting a missing arrival stop.
const loopFeed: GtfsFeed = {
  routes: [{ id: 'TL-13', shortName: 'LLCCW', longName: 'Day', type: 3 }],
  stops: [
    { id: 'TL-200', name: 'Research Dr at Duke Clinic (Day)', lat: 36.01, lon: -78.94 },
    { id: 'TL-90', name: 'The Heights at LaSalle (Day)', lat: 36, lon: -78.95 },
    { id: 'TL-195', name: 'Circuit Dr at F.E.L. Labs (Day)', lat: 36, lon: -78.95 },
  ],
  trips: [{ id: 'day-loop', routeId: 'TL-13', serviceId: 'weekday' }],
  stopTimes: [
    {
      tripId: 'day-loop',
      stopId: 'TL-200',
      arrivalSeconds: 32_400,
      departureSeconds: 32_400,
      stopSequence: 1,
    },
    {
      tripId: 'day-loop',
      stopId: 'TL-90',
      arrivalSeconds: 33_000,
      departureSeconds: 33_000,
      stopSequence: 2,
    },
    {
      tripId: 'day-loop',
      stopId: 'TL-195',
      arrivalSeconds: 33_600,
      departureSeconds: 33_600,
      stopSequence: 3,
    },
    {
      tripId: 'day-loop',
      stopId: 'TL-200',
      arrivalSeconds: 34_200,
      departureSeconds: 34_200,
      stopSequence: 4,
    },
  ],
  frequencies: [],
  calendars: [
    {
      serviceId: 'weekday',
      startDate: '2026-08-01',
      endDate: '2026-12-31',
      weekdays: [false, true, true, true, true, true, false],
    },
  ],
  calendarDates: [],
  shapes: [],
};

const baseSettings: UserSettings = {
  campusId: 'duke',
  language: 'en',
  defaultBufferMinutes: 10,
  walkingSpeedMetersPerSecond: 1.3,
  walkingCorrectionFactor: 1.25,
  homeTransit: { routeId: 'TL-13', routeFamilyId: 'duke-llccw', originStopId: 'TL-195' },
  classStopBindings: {},
  groupClassStopsByBuilding: false,
  buildingStopBindings: {},
};

const fridayClass: ClassEvent = {
  id: 'friday',
  title: 'Friday seminar',
  startTime: new Date('2026-09-25T10:00:00-04:00'),
  endTime: new Date('2026-09-25T11:00:00-04:00'),
  location: 'CIEMAS 2240',
};

const saturdayClass: ClassEvent = {
  ...fridayClass,
  id: 'saturday',
  startTime: new Date('2026-09-26T10:00:00-04:00'),
  endTime: new Date('2026-09-26T11:00:00-04:00'),
};

const planFor = (classEvent: ClassEvent, settings: UserSettings) => {
  const plans = buildWeekPlans({
    events: [classEvent],
    feed: loopFeed,
    settings,
    buildings: [],
    serviceTimezone: 'America/New_York',
    now: new Date('2026-09-23T12:00:00Z'),
    resolveTransitSelections: (selection) => [selection],
  });
  return plans[0];
};

describe('buildWeekPlans arrival-stop status', () => {
  it('reports a plan for a bound loop-terminus arrival stop', () => {
    const settings: UserSettings = {
      ...baseSettings,
      classStopBindings: { [classBindingKey(fridayClass)]: 'TL-200' },
    };
    expect(planFor(fridayClass, settings)).toMatchObject({ status: 'ready' });
  });

  it('asks for an arrival stop only when none is bound', () => {
    expect(planFor(fridayClass, baseSettings)).toMatchObject({ status: 'arrival-stop-missing' });
  });

  it('reports no matching departure when a stop is bound but nothing resolves', () => {
    const settings: UserSettings = {
      ...baseSettings,
      classStopBindings: { [classBindingKey(saturdayClass)]: 'TL-200' },
    };
    const plans = buildWeekPlans({
      events: [saturdayClass],
      feed: loopFeed,
      settings,
      buildings: [],
      serviceTimezone: 'America/New_York',
      now: new Date('2026-09-23T12:00:00Z'),
      // Weekday-only service: the resolver intentionally finds no candidate for a Saturday class.
      resolveTransitSelections: () => [],
    });
    expect(plans[0]).toMatchObject({ status: 'no-matching-departure' });
  });
});
