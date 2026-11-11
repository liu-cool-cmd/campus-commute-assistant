import { describe, expect, it } from 'vitest';
import type { RealtimeRoute, VehiclePosition } from '../types';
import { DEFAULT_STALE_AFTER_SECONDS } from './routeProgress';
import { sortRoutesForExplorer, summarizeRouteVehicles, visibleVehiclesFor } from './routeExplorer';

const route = (id: string, name: string): RealtimeRoute => ({
  routeId: id,
  providerRouteId: `p-${id}`,
  name,
  isRunning: true,
  isLoop: false,
  polyline: [
    { lat: 36, lon: -78.9 },
    { lat: 36.01, lon: -78.91 },
  ],
  stops: [],
});

const vehicle = (id: string, routeId: string, ageSeconds: number): VehiclePosition => ({
  vehicleId: id,
  routeId,
  lat: 36.005,
  lon: -78.905,
  gpsAgeSeconds: ageSeconds,
  isOnRoute: true,
  recordedAt: new Date(Date.now() - ageSeconds * 1000),
});

describe('visibleVehiclesFor', () => {
  it('shows only the selected line’s vehicles', () => {
    const vehicles = [vehicle('a', 'TL-13', 5), vehicle('b', 'TL-19', 5), vehicle('c', 'TL-13', 9)];
    expect(visibleVehiclesFor(vehicles, 'TL-13').map((v) => v.vehicleId)).toEqual(['a', 'c']);
    expect(visibleVehiclesFor(vehicles, 'TL-19').map((v) => v.vehicleId)).toEqual(['b']);
  });

  it('hides vehicles older than the shared 60-second staleness threshold', () => {
    const vehicles = [
      vehicle('fresh', 'TL-13', DEFAULT_STALE_AFTER_SECONDS),
      vehicle('edge', 'TL-13', DEFAULT_STALE_AFTER_SECONDS + 1),
      vehicle('old', 'TL-13', 600),
    ];
    expect(visibleVehiclesFor(vehicles, 'TL-13').map((v) => v.vehicleId)).toEqual(['fresh']);
  });

  it('returns nothing for a line with no vehicles, and for an unset selection', () => {
    const vehicles = [vehicle('a', 'TL-13', 5)];
    expect(visibleVehiclesFor(vehicles, 'TL-4')).toEqual([]);
    expect(visibleVehiclesFor(vehicles, undefined)).toEqual([]);
  });

  it('matches vehicles on any published line, not only a saved commute line', () => {
    const vehicles = [vehicle('a', 'TL-21', 5), vehicle('b', 'TL-4', 5)];
    expect(visibleVehiclesFor(vehicles, 'TL-21').map((v) => v.vehicleId)).toEqual(['a']);
    expect(visibleVehiclesFor(vehicles, 'TL-4').map((v) => v.vehicleId)).toEqual(['b']);
  });
});

describe('summarizeRouteVehicles', () => {
  it('separates fresh vehicles from the ones too old to draw', () => {
    const vehicles = [
      vehicle('fresh-a', 'TL-13', 5),
      vehicle('stale-a', 'TL-13', DEFAULT_STALE_AFTER_SECONDS + 1),
      vehicle('stale-b', 'TL-13', 300),
      vehicle('other', 'TL-19', 5),
    ];
    expect(summarizeRouteVehicles(vehicles, 'TL-13')).toEqual({
      routeId: 'TL-13',
      fresh: vehicles.slice(0, 1),
      staleCount: 2,
    });
  });

  it('reports zero stale vehicles when every position is fresh', () => {
    const vehicles = [vehicle('a', 'TL-13', 0), vehicle('b', 'TL-13', 12)];
    expect(summarizeRouteVehicles(vehicles, 'TL-13').staleCount).toBe(0);
  });

  it('does not claim a stale vehicle as fresh when a line stops reporting entirely', () => {
    const vehicles = [vehicle('a', 'TL-13', DEFAULT_STALE_AFTER_SECONDS + 5)];
    const summary = summarizeRouteVehicles(vehicles, 'TL-13');
    expect(summary.fresh).toEqual([]);
    expect(summary.staleCount).toBe(1);
  });
});

describe('sortRoutesForExplorer', () => {
  it('lists lines with reporting vehicles first, then alphabetically', () => {
    const routes = [route('TL-3', 'C1'), route('TL-21', 'PR1'), route('TL-13', 'LLCCW')];
    const vehicles = [vehicle('a', 'TL-21', 5), vehicle('b', 'TL-13', 5), vehicle('c', 'TL-13', 8)];
    expect(sortRoutesForExplorer(routes, vehicles).map((r) => r.routeId)).toEqual([
      'TL-13',
      'TL-21',
      'TL-3',
    ]);
  });

  it('keeps a stable order by line name when no line has vehicles', () => {
    // C1 < LLCCW < PR1 by display name, which is the order the user reads.
    const routes = [route('TL-21', 'PR1'), route('TL-3', 'C1'), route('TL-13', 'LLCCW')];
    expect(sortRoutesForExplorer(routes, []).map((r) => r.name)).toEqual(['C1', 'LLCCW', 'PR1']);
  });

  it('does not mutate the caller’s array', () => {
    const routes = [route('TL-21', 'PR1'), route('TL-13', 'LLCCW')];
    const copy = [...routes];
    sortRoutesForExplorer(routes, [vehicle('a', 'TL-13', 5)]);
    expect(routes).toEqual(copy);
  });
});
