import { DEFAULT_STALE_AFTER_SECONDS } from './routeProgress';
import type { RealtimeRoute, VehiclePosition } from '../types';

/**
 * Line-explorer helpers. These are presentation-level filters over an existing snapshot:
 * the explorer never fetches, selects a next bus, or predicts an arrival.
 */

export interface RouteVehicleSummary {
  routeId: string;
  fresh: VehiclePosition[];
  staleCount: number;
}

/** Vehicles on `routeId` whose GPS is inside the shared staleness threshold. */
export function visibleVehiclesFor(
  vehicles: VehiclePosition[],
  routeId: string | undefined,
): VehiclePosition[] {
  if (!routeId) return [];
  return vehicles.filter(
    (vehicle) =>
      vehicle.routeId === routeId && vehicle.gpsAgeSeconds <= DEFAULT_STALE_AFTER_SECONDS,
  );
}

/** Splits one line's vehicles into the ones to draw and the count to report as too old. */
export function summarizeRouteVehicles(
  vehicles: VehiclePosition[],
  routeId: string | undefined,
): RouteVehicleSummary {
  const onRoute = routeId ? vehicles.filter((vehicle) => vehicle.routeId === routeId) : [];
  const fresh = onRoute.filter((vehicle) => vehicle.gpsAgeSeconds <= DEFAULT_STALE_AFTER_SECONDS);
  return { routeId: routeId ?? '', fresh, staleCount: onRoute.length - fresh.length };
}

/**
 * Orders lines for the picker: lines with vehicles reporting first, then alphabetical by
 * name so the list is stable between snapshots.
 */
export function sortRoutesForExplorer(
  routes: RealtimeRoute[],
  vehicles: VehiclePosition[],
): RealtimeRoute[] {
  const countFor = (routeId: string) =>
    vehicles.reduce((total, vehicle) => (vehicle.routeId === routeId ? total + 1 : total), 0);
  return [...routes].sort((left, right) => {
    const difference = countFor(right.routeId) - countFor(left.routeId);
    if (difference !== 0) return difference;
    return (left.name || left.routeId).localeCompare(right.name || right.routeId);
  });
}
