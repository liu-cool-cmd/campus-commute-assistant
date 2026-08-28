import { describe, expect, it } from 'vitest';
import { findBuilding } from '../locations/geo';
import type { GtfsFeed, RoutingOptions, StopTime, Trip } from '../types';
import { dukeBuildings } from '../../campuses/duke/buildings';
import { isServiceActive } from '../gtfs/service';
import { getCommuteRecommendations, recommendCommute } from './engine';
import { serviceTimeToDate } from '../gtfs/time';

const origin = { lat: 36, lon: -78.95, label: 'Home' };
const destination = { lat: 36, lon: -78.94, label: 'Class' };
const originStop = { id: 'home-stop', name: 'Home Stop', lat: 36, lon: -78.9499 };
const destinationStop = { id: 'class-stop', name: 'Class Stop', lat: 36, lon: -78.9401 };

function seconds(value: string): number {
  const [hours = 0, minutes = 0, secs = 0] = value.split(':').map(Number);
  return hours * 3600 + minutes * 60 + secs;
}

function makeFeed(
  trips: Array<{ id: string; departure: string; arrival: string; serviceId?: string }>,
): GtfsFeed {
  const gtfsTrips: Trip[] = [];
  const stopTimes: StopTime[] = [];
  for (const trip of trips) {
    gtfsTrips.push({
      id: trip.id,
      routeId: 'c1',
      serviceId: trip.serviceId ?? 'weekday',
    });
    stopTimes.push(
      {
        tripId: trip.id,
        stopId: originStop.id,
        arrivalSeconds: seconds(trip.departure),
        departureSeconds: seconds(trip.departure),
        stopSequence: 1,
      },
      {
        tripId: trip.id,
        stopId: destinationStop.id,
        arrivalSeconds: seconds(trip.arrival),
        departureSeconds: seconds(trip.arrival),
        stopSequence: 2,
      },
    );
  }
  return {
    stops: [originStop, destinationStop],
    routes: [{ id: 'c1', shortName: 'C1', longName: 'East-West', type: 3 }],
    trips: gtfsTrips,
    stopTimes,
    frequencies: [],
    calendars: [
      {
        serviceId: 'weekday',
        weekdays: [false, true, true, true, true, true, false],
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
      {
        serviceId: 'weekend',
        weekdays: [true, false, false, false, false, false, true],
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
    ],
    calendarDates: [],
    shapes: [],
  };
}

function options(feed: GtfsFeed, deadline = '2026-08-24T10:05:00-04:00'): RoutingOptions {
  return {
    feed,
    request: {
      origin,
      destination,
      arrivalDeadline: new Date(deadline),
      bufferMinutes: 7,
    },
    transitSelection: {
      routeId: 'c1',
      originStopId: originStop.id,
      destinationStopId: destinationStop.id,
    },
    serviceTimezone: 'America/New_York',
    walkingSpeedMetersPerSecond: 1.3,
    walkingCorrectionFactor: 1.25,
  };
}

function requiredRecommendation(request: RoutingOptions) {
  const result = recommendCommute(request);
  expect(result).toBeDefined();
  return result!;
}

describe('routing engine', () => {
  it('chooses the latest feasible trip when several buses exist', () => {
    const feed = makeFeed([
      { id: 'early', departure: '09:20:00', arrival: '09:40:00' },
      { id: 'recommended', departure: '09:41:00', arrival: '09:56:00' },
      { id: 'late', departure: '09:50:00', arrival: '10:05:00' },
    ]);

    const result = requiredRecommendation(options(feed));
    expect(result.trip?.id).toBe('recommended');
    expect(result.departureTime?.toISOString()).toBe('2026-08-24T13:41:00.000Z');
  });

  it('rejects the last trip when its last-mile walk misses the deadline', () => {
    const feed = makeFeed([
      { id: 'works', departure: '09:35:00', arrival: '09:53:00' },
      { id: 'misses', departure: '09:45:00', arrival: '09:58:00' },
    ]);
    const result = requiredRecommendation(options(feed));
    expect(result.trip?.id).toBe('works');
  });

  it('applies the requested class buffer', () => {
    const feed = makeFeed([{ id: 'borderline', departure: '09:45:00', arrival: '09:58:00' }]);
    const withBuffer = options(feed);
    withBuffer.request.bufferMinutes = 7;
    const withoutBuffer = options(feed);
    withoutBuffer.request.bufferMinutes = 0;

    expect(recommendCommute(withBuffer)).toBeUndefined();
    expect(requiredRecommendation(withoutBuffer).trip?.id).toBe('borderline');
  });

  it('uses weekend service calendars', () => {
    const feed = makeFeed([]);
    expect(isServiceActive(feed, 'weekday', '2026-08-22')).toBe(false);
    expect(isServiceActive(feed, 'weekend', '2026-08-22')).toBe(true);
  });

  it('honors calendar_dates additions and removals over the base calendar', () => {
    const feed = makeFeed([]);
    feed.calendarDates = [
      { serviceId: 'weekday', date: '2026-08-24', exceptionType: 2 },
      { serviceId: 'weekend', date: '2026-08-24', exceptionType: 1 },
    ];
    expect(isServiceActive(feed, 'weekday', '2026-08-24')).toBe(false);
    expect(isServiceActive(feed, 'weekend', '2026-08-24')).toBe(true);
  });

  it('supports GTFS stop times beyond midnight on the prior service day', () => {
    const feed = makeFeed([
      { id: 'night', departure: '24:20:00', arrival: '24:35:00', serviceId: 'weekday' },
    ]);
    const result = requiredRecommendation(options(feed, '2026-08-25T00:50:00-04:00'));
    expect(result.trip?.id).toBe('night');
    expect(result.departureTime?.toISOString()).toBe('2026-08-25T04:20:00.000Z');
  });

  it('returns no recommendation when the selected transit has no feasible trip', () => {
    expect(recommendCommute(options(makeFeed([])))).toBeUndefined();
  });

  it('reports an unknown building through the location resolver', () => {
    expect(findBuilding('Some New Building 404', dukeBuildings)).toBeUndefined();
    expect(findBuilding('CIEMAS 2240', dukeBuildings)?.id).toBe('ciemas');
  });

  it('never substitutes a different route for the user-selected route', () => {
    const feed = makeFeed([{ id: 'selected-bus', departure: '09:25:00', arrival: '09:45:00' }]);
    feed.routes.push({ id: 'other-route', shortName: 'OTHER', longName: 'Other', type: 3 });
    feed.trips.push({
      id: 'other-later-bus',
      routeId: 'other-route',
      serviceId: 'weekday',
    });
    feed.stopTimes.push(
      {
        tripId: 'other-later-bus',
        stopId: originStop.id,
        arrivalSeconds: seconds('09:40:00'),
        departureSeconds: seconds('09:40:00'),
        stopSequence: 1,
      },
      {
        tripId: 'other-later-bus',
        stopId: destinationStop.id,
        arrivalSeconds: seconds('09:50:00'),
        departureSeconds: seconds('09:50:00'),
        stopSequence: 2,
      },
    );

    const results = getCommuteRecommendations(options(feed));
    expect(results).not.toHaveLength(0);
    expect(results.every((result) => result.route?.id === 'c1')).toBe(true);
    expect(results.every((result) => result.trip?.id === 'selected-bus')).toBe(true);
  });

  it('requires the selected boarding and alighting stops in the selected order', () => {
    const feed = makeFeed([{ id: 'forward-only', departure: '09:30:00', arrival: '09:45:00' }]);
    const request = options(feed);
    request.transitSelection = {
      routeId: 'c1',
      originStopId: destinationStop.id,
      destinationStopId: originStop.id,
    };

    expect(getCommuteRecommendations(request)).toEqual([]);
  });

  it('evaluates scheduled and exact frequency-based trips together', () => {
    const feed = makeFeed([
      { id: 'scheduled', departure: '09:35:00', arrival: '09:50:00' },
      { id: 'TL-frequency-template', departure: '00:00:00', arrival: '00:10:00' },
    ]);
    feed.frequencies = [
      {
        tripId: 'TL-frequency-template',
        startSeconds: seconds('09:20:00'),
        endSeconds: seconds('09:50:00'),
        headwaySeconds: 600,
        exactTimes: 1,
      },
    ];

    const result = requiredRecommendation(options(feed));
    expect(result.trip?.id).toBe('TL-frequency-template');
    expect(result.departureTime?.toISOString()).toBe('2026-08-24T13:40:00.000Z');
    expect(result.departureTimeIsExact).toBe(true);
    expect(result.waitingMinutes).toBe(0);
  });

  it('preserves relative stop offsets from a frequency trip template', () => {
    const feed = makeFeed([{ id: 'raw-trip-id', departure: '00:05:00', arrival: '00:15:00' }]);
    feed.stopTimes.unshift({
      tripId: 'raw-trip-id',
      stopId: 'preceding-stop',
      arrivalSeconds: 0,
      departureSeconds: 0,
      stopSequence: 0,
    });
    feed.frequencies = [
      {
        tripId: 'raw-trip-id',
        startSeconds: seconds('09:00:00'),
        endSeconds: seconds('09:30:00'),
        headwaySeconds: 600,
        exactTimes: 1,
      },
    ];

    const result = requiredRecommendation(options(feed, '2026-08-24T09:35:00-04:00'));
    expect(result.trip?.id).toBe('raw-trip-id');
    expect(result.departureTime?.toISOString()).toBe('2026-08-24T13:15:00.000Z');
  });

  it('adds a full-headway wait and low confidence for inexact frequency service', () => {
    const feed = makeFeed([{ id: 'headway-trip', departure: '00:00:00', arrival: '00:10:00' }]);
    feed.frequencies = [
      {
        tripId: 'headway-trip',
        startSeconds: seconds('09:20:00'),
        endSeconds: seconds('09:50:00'),
        headwaySeconds: 600,
        exactTimes: 0,
      },
    ];

    const result = requiredRecommendation(options(feed));
    expect(result.trip?.id).toBe('headway-trip');
    expect(result.departureTimeIsExact).toBe(false);
    expect(result.frequencyHeadwayMinutes).toBe(10);
    expect(result.waitingMinutes).toBe(10);
    expect(result.confidence).toBe('low');
  });

  it('marks departures at interpolated supplemental stops as approximate', () => {
    const feed = makeFeed([{ id: 'supplement', departure: '09:30:00', arrival: '09:45:00' }]);
    const boardingTime = feed.stopTimes.find(
      (stopTime) => stopTime.tripId === 'supplement' && stopTime.stopId === originStop.id,
    );
    expect(boardingTime).toBeDefined();
    boardingTime!.timingSource = 'interpolated';

    const result = requiredRecommendation(options(feed));
    expect(result.departureTimeIsExact).toBe(false);
    expect(result.confidence).toBe('low');
  });
});

describe('GTFS timezone conversion', () => {
  it('uses the campus timezone rather than the device timezone', () => {
    expect(
      serviceTimeToDate('2026-08-24', seconds('09:41:00'), 'America/New_York').toISOString(),
    ).toBe('2026-08-24T13:41:00.000Z');
  });
});
