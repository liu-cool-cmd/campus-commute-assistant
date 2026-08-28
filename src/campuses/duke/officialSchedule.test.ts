import { describe, expect, it } from 'vitest';
import { getTripInstances } from '../../core/gtfs/frequencies';
import type { GtfsFeed, Stop } from '../../core/types';
import {
  DUKE_LLCCW_SCHEDULE_URL,
  DUKE_OFFICIAL_SCHEDULE_PREFIX,
  migrateDukeOfficialSelection,
  supplementDukeOfficialSchedules,
} from './officialSchedule';

const routeStopIds = [
  'TL-90',
  'TL-188',
  'TL-189',
  'TL-190',
  'TL-192',
  'TL-193',
  'TL-195',
  'TL-196',
  'TL-197',
  'TL-198',
  'TL-199',
  'TL-200',
  'TL-201',
  'TL-202',
  'TL-203',
  'TL-205',
  'TL-206',
  'TL-216',
  'TL-221',
  'TL-269',
  'TL-270',
  'TL-278',
];
const officialStops: Stop[] = routeStopIds.map((id, index) => ({
  id,
  name: `Raw stop ${id}`,
  lat: 36 + index / 10_000,
  lon: -78.95 + index / 10_000,
}));

function rawFeed(): GtfsFeed {
  return {
    stops: officialStops,
    routes: [
      { id: 'TL-13', shortName: '', longName: 'LLCCW: LaSalle Loop Counterclockwise', type: 3 },
      {
        id: 'TL-19',
        shortName: '',
        longName: 'LLCCWN: LaSalle Loop Counterclockwise Night',
        type: 3,
      },
    ],
    trips: [],
    stopTimes: [],
    frequencies: [],
    calendars: [],
    calendarDates: [],
    shapes: [],
  };
}

describe('Duke official timetable supplement', () => {
  it('adds the published LLCCW 24-minute daytime departures as exact frequencies', () => {
    const feed = supplementDukeOfficialSchedules(rawFeed());
    const trip = feed.trips.find((candidate) => candidate.routeId === 'TL-13');
    expect(trip).toMatchObject({
      id: `${DUKE_OFFICIAL_SCHEDULE_PREFIX}llccw:weekday-day-template`,
      routeId: 'TL-13',
      scheduleSource: {
        kind: 'official-supplement',
        url: DUKE_LLCCW_SCHEDULE_URL,
      },
    });

    const stopTimes = feed.stopTimes.filter((stopTime) => stopTime.tripId === trip?.id);
    const frequencies = feed.frequencies.filter((frequency) => frequency.tripId === trip?.id);
    const instances = getTripInstances(stopTimes, frequencies);
    expect(frequencies).toEqual([
      {
        tripId: trip?.id,
        startSeconds: 7 * 3_600 + 12 * 60,
        endSeconds: 18 * 3_600,
        headwaySeconds: 24 * 60,
        exactTimes: 1,
      },
    ]);
    expect(instances).toHaveLength(27);
    expect(stopTimes).toHaveLength(18);
    expect(stopTimes.map((stopTime) => stopTime.stopId)).toContain('TL-278');
    expect(stopTimes.find((stopTime) => stopTime.stopId === 'TL-201')?.timingSource).toBe(
      'interpolated',
    );
    expect(stopTimes.find((stopTime) => stopTime.stopId === 'TL-270')?.timingSource).toBe(
      'published',
    );
    expect(instances[0]?.timeOffsetSeconds).toBe(7 * 3_600 + 12 * 60);
    expect(instances.at(-1)?.timeOffsetSeconds).toBe(17 * 3_600 + 36 * 60);
    expect((stopTimes.at(-1)?.arrivalSeconds ?? 0) + instances.at(-1)!.timeOffsetSeconds).toBe(
      17 * 3_600 + 56 * 60,
    );
  });

  it('adds each published LLCCWN evening departure without filling the 6:30 gap', () => {
    const feed = supplementDukeOfficialSchedules(rawFeed());
    const departures = feed.trips
      .filter((trip) => trip.routeId === 'TL-19')
      .map((trip) =>
        feed.stopTimes.find(
          (stopTime) => stopTime.tripId === trip.id && stopTime.stopSequence === 1,
        ),
      )
      .map((stopTime) => stopTime?.departureSeconds);

    expect(departures).toEqual([
      18 * 3_600,
      19 * 3_600,
      19 * 3_600 + 1_800,
      20 * 3_600,
      20 * 3_600 + 1_800,
      21 * 3_600,
      21 * 3_600 + 1_800,
    ]);
  });

  it('does not replace or duplicate variants once the raw feed supplies trips', () => {
    const feed = rawFeed();
    feed.trips = [
      { id: 'raw-day-trip', routeId: 'TL-13', serviceId: 'raw-service' },
      { id: 'raw-night-trip', routeId: 'TL-19', serviceId: 'raw-service' },
    ];

    expect(supplementDukeOfficialSchedules(feed)).toBe(feed);
  });

  it('does not inject a partial schedule when a referenced raw stop is unavailable', () => {
    const feed = rawFeed();
    feed.stops = feed.stops.filter((stop) => stop.id !== 'TL-195');

    expect(supplementDukeOfficialSchedules(feed)).toBe(feed);
  });

  it('migrates previously saved synthetic stop IDs to raw route-specific IDs', () => {
    expect(
      migrateDukeOfficialSelection({
        routeId: 'TL-13',
        originStopId: `${DUKE_OFFICIAL_SCHEDULE_PREFIX}stop:12030`,
        destinationStopId: `${DUKE_OFFICIAL_SCHEDULE_PREFIX}stop:6647`,
      }),
    ).toEqual({
      routeId: 'TL-13',
      originStopId: 'TL-200',
      destinationStopId: 'TL-90',
    });
  });
});
