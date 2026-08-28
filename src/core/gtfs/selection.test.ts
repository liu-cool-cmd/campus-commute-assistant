import { describe, expect, it } from 'vitest';
import type { GtfsFeed } from '../types';
import { getDownstreamStops, getRouteStops } from './selection';

const feed: GtfsFeed = {
  stops: ['a', 'b', 'c'].map((id) => ({ id, name: id.toUpperCase(), lat: 0, lon: 0 })),
  routes: [{ id: 'loop', shortName: 'L', longName: 'Loop', type: 3 }],
  trips: [{ id: 'trip', routeId: 'loop', serviceId: 'weekday' }],
  stopTimes: [
    { tripId: 'trip', stopId: 'a', arrivalSeconds: 0, departureSeconds: 0, stopSequence: 1 },
    { tripId: 'trip', stopId: 'b', arrivalSeconds: 60, departureSeconds: 60, stopSequence: 2 },
    { tripId: 'trip', stopId: 'c', arrivalSeconds: 120, departureSeconds: 120, stopSequence: 3 },
    { tripId: 'trip', stopId: 'a', arrivalSeconds: 180, departureSeconds: 180, stopSequence: 4 },
  ],
  frequencies: [],
  calendars: [],
  calendarDates: [],
  shapes: [],
};

describe('GTFS stop selection', () => {
  it('lists route stops once in route order', () => {
    expect(getRouteStops(feed, 'loop').map((stop) => stop.id)).toEqual(['a', 'b', 'c']);
  });

  it('only offers stops downstream of the saved home boarding stop', () => {
    expect(getDownstreamStops(feed, 'loop', 'b').map((stop) => stop.id)).toEqual(['a', 'c']);
  });
});
