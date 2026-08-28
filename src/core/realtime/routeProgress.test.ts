import { describe, expect, it } from 'vitest';
import type { Coordinates, RealtimeRoute, RealtimeSnapshot, VehiclePosition } from '../types';
import {
  calculateLiveTripProgress,
  directedCyclicDistance,
  projectPointToRoute,
  unwrapCyclicDistances,
} from './routeProgress';

const at = (lon: number, lat = 36): Coordinates => ({ lat, lon });

const openRoute: RealtimeRoute = {
  routeId: 'route-a',
  providerRouteId: '7',
  name: 'Route A',
  isLoop: false,
  polyline: [at(-78.96), at(-78.95), at(-78.94), at(-78.93), at(-78.92)],
  stops: [
    { id: 'board', name: 'Board', lat: 36, lon: -78.94, order: 10 },
    { id: 'arrive', name: 'Arrive', lat: 36, lon: -78.925, order: 20 },
  ],
};

const vehicle = (vehicleId: string, lon: number, age = 10): VehiclePosition => ({
  vehicleId,
  name: vehicleId,
  routeId: 'route-a',
  providerRouteId: '7',
  lat: 36,
  lon,
  bearing: 90,
  groundSpeed: 12,
  gpsAgeSeconds: age,
  isOnRoute: true,
  recordedAt: new Date(new Date('2026-08-28T12:00:00Z').getTime() - age * 1_000),
});

const snapshot = (vehicles: VehiclePosition[], route = openRoute): RealtimeSnapshot => ({
  receivedAt: new Date('2026-08-28T12:00:00Z'),
  routes: [route],
  vehicles,
});

describe('route progress', () => {
  it('projects GPS to the route and chooses the closest upstream vehicle by route distance', () => {
    const result = calculateLiveTripProgress({
      snapshot: snapshot([vehicle('far', -78.955), vehicle('next', -78.945)]),
      routeId: 'route-a',
      boardingStopId: 'board',
      arrivalStopId: 'arrive',
      now: new Date('2026-08-28T12:00:00Z'),
    });

    expect(result.status).toBe('live');
    expect(result.vehicle?.vehicleId).toBe('next');
    expect(result.distanceToBoardingMeters).toBeGreaterThan(400);
    expect(result.distanceToBoardingMeters).toBeLessThan(500);
    expect(result.stopsAway).toBe(1);
    expect(result.vehicleToBoardingPath.length).toBeGreaterThan(1);
    expect(result.boardingToArrivalPath.length).toBeGreaterThan(1);
  });

  it('does not choose a vehicle that has already passed a stop on an open route', () => {
    const result = calculateLiveTripProgress({
      snapshot: snapshot([vehicle('passed', -78.935), vehicle('upstream', -78.95)]),
      routeId: 'route-a',
      boardingStopId: 'board',
      arrivalStopId: 'arrive',
      now: new Date('2026-08-28T12:00:00Z'),
    });
    expect(result.vehicle?.vehicleId).toBe('upstream');
  });

  it('marks old GPS snapshots stale', () => {
    const result = calculateLiveTripProgress({
      snapshot: snapshot([vehicle('old', -78.945, 120)]),
      routeId: 'route-a',
      boardingStopId: 'board',
      arrivalStopId: 'arrive',
      now: new Date('2026-08-28T12:00:00Z'),
    });
    expect(result.status).toBe('stale');
    expect(result.reason).toBe('stale-gps');
  });

  it('returns unavailable when a selected stop is absent from realtime metadata', () => {
    const result = calculateLiveTripProgress({
      snapshot: snapshot([vehicle('bus', -78.945)]),
      routeId: 'route-a',
      boardingStopId: 'TL-270',
      arrivalStopId: 'arrive',
      now: new Date('2026-08-28T12:00:00Z'),
    });
    expect(result.status).toBe('unavailable');
    expect(result.reason).toBe('stop-not-found');
  });

  it('allows one normal seam wrap when validating loop stop order', () => {
    expect(unwrapCyclicDistances([8_200, 8_800, 9_400, 300, 900], 10_000)).toEqual([
      8_200, 8_800, 9_400, 10_300, 10_900,
    ]);
    expect(unwrapCyclicDistances([8_000, 500, 7_000, 200], 10_000)).toBeUndefined();
  });

  it('computes directed cyclic distance instead of the shortest geometric distance', () => {
    expect(directedCyclicDistance(9_000, 1_000, 10_000)).toBe(2_000);
    expect(directedCyclicDistance(1_000, 9_000, 10_000)).toBe(8_000);
  });

  it('selects the nearest vehicle by forward loop distance without crossing the seam', () => {
    const loop: RealtimeRoute = {
      routeId: 'loop',
      providerRouteId: '13',
      name: 'Loop',
      isLoop: true,
      polyline: [at(-78.95), at(-78.94), at(-78.94, 36.01), at(-78.95, 36.01), at(-78.95)],
      stops: [
        { id: 'board', name: 'Board', lat: 36.01, lon: -78.94, order: 10 },
        { id: 'arrive', name: 'Arrive', lat: 36.01, lon: -78.95, order: 20 },
      ],
    };
    const loopVehicle = (vehicleId: string, lat: number, lon: number, heading: number) => ({
      ...vehicle(vehicleId, lon),
      routeId: 'loop',
      lat,
      bearing: heading,
    });
    const result = calculateLiveTripProgress({
      snapshot: snapshot(
        [
          loopVehicle('far', 36, -78.945, 90),
          loopVehicle('next', 36.008, -78.94, 0),
          loopVehicle('after-seam', 36.004, -78.95, 180),
        ],
        loop,
      ),
      routeId: 'loop',
      boardingStopId: 'board',
      arrivalStopId: 'arrive',
      now: new Date('2026-08-28T12:00:00Z'),
    });
    expect(result.status).toBe('live');
    expect(result.vehicle?.vehicleId).toBe('next');
  });

  it('marks a loop ambiguous when every vehicle would need an unconfirmed seam crossing', () => {
    const loop: RealtimeRoute = {
      routeId: 'loop',
      providerRouteId: '13',
      name: 'Loop',
      isLoop: true,
      polyline: [at(-78.95), at(-78.94), at(-78.94, 36.01), at(-78.95, 36.01), at(-78.95)],
      stops: [
        { id: 'board', name: 'Board', lat: 36, lon: -78.945, order: 10 },
        { id: 'arrive', name: 'Arrive', lat: 36.01, lon: -78.94, order: 20 },
      ],
    };
    const bus = { ...vehicle('bus', -78.95), routeId: 'loop', lat: 36.005, bearing: 180 };
    const result = calculateLiveTripProgress({
      snapshot: snapshot([bus], loop),
      routeId: 'loop',
      boardingStopId: 'board',
      arrivalStopId: 'arrive',
      now: new Date('2026-08-28T12:00:00Z'),
    });
    expect(result.status).toBe('ambiguous');
    expect(result.reason).toBe('seam-crossing');
  });

  it('uses heading only to disambiguate overlapping route segments', () => {
    const line = [at(-78.95), at(-78.94), at(-78.95)];
    expect(projectPointToRoute(at(-78.945), line, { isLoop: true })).toBeUndefined();
    expect(
      projectPointToRoute(at(-78.945), line, { isLoop: true, heading: 90 })?.segmentIndex,
    ).toBe(0);
  });
});
