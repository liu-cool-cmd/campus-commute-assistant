import type {
  Coordinates,
  RealtimeRoute,
  RealtimeSnapshot,
  VehiclePosition,
} from '../../core/types';
import { distanceMeters } from '../../core/realtime/routeProgress';

export const DUKE_TRANSLOC_VEHICLES_URL =
  'https://duke.transloc.com/Services/JSONPRelay.svc/GetMapVehiclePoints?apiKey=&isPublicMap=true';
export const DUKE_TRANSLOC_ROUTES_URL =
  'https://duke.transloc.com/Services/JSONPRelay.svc/GetRoutesForMapWithScheduleWithEncodedLine?apiKey=&isPublicMap=true';

export interface TranslocVehicleResponse {
  VehicleID: number;
  Name: string;
  RouteID: number;
  Latitude: number;
  Longitude: number;
  Heading: number;
  GroundSpeed: number;
  Seconds: number;
  TimeStamp: string;
  IsOnRoute: boolean;
  IsDelayed: boolean;
}

export interface TranslocStopResponse {
  RouteStopID: number;
  AddressID: number;
  GtfsId: string;
  Name: string;
  Order: number;
  Latitude: number;
  Longitude: number;
}

export interface TranslocRouteResponse {
  RouteID: number;
  GtfsId: string;
  Description: string;
  EncodedPolyline: string;
  MapLineColor?: string;
  IsRunning: boolean;
  Stops: TranslocStopResponse[];
}

export function decodeGooglePolyline(encoded: string, precision = 5): Coordinates[] {
  const factor = 10 ** precision;
  const points: Coordinates[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  const decodeValue = () => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      if (index >= encoded.length) throw new Error('Invalid encoded polyline');
      byte = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < encoded.length) {
    latitude += decodeValue();
    longitude += decodeValue();
    points.push({ lat: latitude / factor, lon: longitude / factor });
  }
  return points;
}

export function parseTranslocRoutes(rawRoutes: TranslocRouteResponse[]): RealtimeRoute[] {
  return rawRoutes.flatMap((raw) => {
    if (!Number.isFinite(raw.RouteID) || !raw.GtfsId || !raw.EncodedPolyline) return [];
    let polyline: Coordinates[];
    try {
      polyline = decodeGooglePolyline(raw.EncodedPolyline);
    } catch {
      return [];
    }
    if (polyline.length < 2) return [];
    return [
      {
        routeId: raw.GtfsId,
        providerRouteId: String(raw.RouteID),
        name: raw.Description || raw.GtfsId,
        color: raw.MapLineColor
          ? raw.MapLineColor.startsWith('#')
            ? raw.MapLineColor
            : `#${raw.MapLineColor}`
          : undefined,
        isRunning: raw.IsRunning,
        isLoop: distanceMeters(polyline[0]!, polyline.at(-1)!) <= 75,
        polyline,
        stops: [...(raw.Stops ?? [])]
          .filter(
            (stop) =>
              Boolean(stop.GtfsId) &&
              Number.isFinite(stop.Latitude) &&
              Number.isFinite(stop.Longitude) &&
              Number.isFinite(Number(stop.Order)),
          )
          .sort((left, right) => Number(left.Order) - Number(right.Order))
          .map((stop) => ({
            id: stop.GtfsId,
            providerStopId: String(stop.RouteStopID),
            name: stop.Name || stop.GtfsId,
            order: Number(stop.Order),
            lat: stop.Latitude,
            lon: stop.Longitude,
          })),
      },
    ];
  });
}

export function parseTranslocVehicles(
  rawVehicles: TranslocVehicleResponse[],
  routes: RealtimeRoute[],
  receivedAt: Date,
): VehiclePosition[] {
  const routeIdByProviderId = new Map(
    routes.map((route) => [route.providerRouteId, route.routeId] as const),
  );
  return rawVehicles.flatMap((raw) => {
    const providerRouteId = String(raw.RouteID);
    const routeId = routeIdByProviderId.get(providerRouteId);
    if (
      !routeId ||
      !Number.isFinite(raw.VehicleID) ||
      !Number.isFinite(raw.Latitude) ||
      !Number.isFinite(raw.Longitude)
    ) {
      return [];
    }
    const gpsAgeSeconds = Math.max(0, Number.isFinite(raw.Seconds) ? raw.Seconds : 0);
    return [
      {
        vehicleId: String(raw.VehicleID),
        name: raw.Name || String(raw.VehicleID),
        routeId,
        providerRouteId,
        lat: raw.Latitude,
        lon: raw.Longitude,
        bearing: Number.isFinite(raw.Heading) ? ((raw.Heading % 360) + 360) % 360 : undefined,
        groundSpeed: Number.isFinite(raw.GroundSpeed) ? raw.GroundSpeed : undefined,
        gpsAgeSeconds,
        recordedAt: new Date(receivedAt.getTime() - gpsAgeSeconds * 1_000),
        isOnRoute: raw.IsOnRoute,
        isDelayed: raw.IsDelayed,
      },
    ];
  });
}

export function makeTranslocSnapshot(
  rawRoutes: TranslocRouteResponse[],
  rawVehicles: TranslocVehicleResponse[],
  receivedAt = new Date(),
): RealtimeSnapshot {
  const routes = parseTranslocRoutes(rawRoutes);
  return {
    receivedAt,
    routes,
    vehicles: parseTranslocVehicles(rawVehicles, routes, receivedAt),
  };
}
