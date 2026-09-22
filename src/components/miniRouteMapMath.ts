import type { Coordinates, RealtimeRouteStop, VehiclePosition } from '../core/types';
import { distanceMeters } from '../core/realtime/routeProgress';

export const SVG_VIEWBOX_SIZE = 300;
export const SVG_CENTER = 150;
export const SVG_INNER_MIN = 24;
export const SVG_INNER_MAX = 276;
export const SVG_DRAW_RADIUS = 120; // Radius in pixels for half-span

export const MIN_VIEWPORT_SPAN_METERS = 380;
export const MAX_VIEWPORT_SPAN_METERS = 1200;

export interface ProjectedPoint {
  x: number;
  y: number;
}

export interface EdgeIndicator {
  isOffscreen: boolean;
  edgeX: number;
  edgeY: number;
  angleDeg: number;
}

export interface MiniMapProjection {
  center: Coordinates;
  spanMeters: number;
  pixelsPerMeter: number;
  project(coord: Coordinates): ProjectedPoint;
  getEdgeIndicator(coord: Coordinates): EdgeIndicator;
}

export interface MiniMapViewportOptions {
  vehicle?: VehiclePosition;
  boardingStop?: RealtimeRouteStop;
  arrivalStop?: RealtimeRouteStop;
  vehicleToBoardingPath?: Coordinates[];
  boardingToArrivalPath?: Coordinates[];
  fullPolyline?: Coordinates[];
}

/**
 * Computes an isotropic (1:1 aspect ratio), North-Up projection for the square mini route map.
 * Ensures the displayed area is capped at MAX_VIEWPORT_SPAN_METERS to prioritize readability
 * of the local route segment (vehicle -> boarding and immediate context).
 */
export function createMiniMapProjection(options: MiniMapViewportOptions): MiniMapProjection {
  const {
    vehicle,
    boardingStop,
    arrivalStop,
    vehicleToBoardingPath = [],
    boardingToArrivalPath = [],
    fullPolyline = [],
  } = options;

  // 1. Determine anchor points to include in the viewport
  const keyPoints: Coordinates[] = [];

  // Boarding stop is primary anchor
  if (boardingStop) {
    keyPoints.push(boardingStop);
  }

  // Check if vehicle is within readable distance of boarding stop
  const vehicleDist =
    vehicle && boardingStop
      ? distanceMeters(vehicle, boardingStop)
      : vehicle
        ? 0
        : undefined;

  const vehicleIsNearby =
    vehicle && (vehicleDist === undefined || vehicleDist <= MAX_VIEWPORT_SPAN_METERS);

  if (vehicle && vehicleIsNearby) {
    keyPoints.push(vehicle);
    keyPoints.push(...vehicleToBoardingPath);
  }

  // Check if arrival stop can fit within MAX_VIEWPORT_SPAN_METERS
  if (arrivalStop && boardingStop) {
    const arrivalDist = distanceMeters(boardingStop, arrivalStop);
    const combinedSpanEstimate =
      (vehicleDist && vehicleIsNearby ? Math.max(vehicleDist, arrivalDist) : arrivalDist);

    if (combinedSpanEstimate <= MAX_VIEWPORT_SPAN_METERS * 0.85) {
      keyPoints.push(arrivalStop);
      keyPoints.push(...boardingToArrivalPath);
    }
  }

  // Fallbacks if no vehicle/boarding stops
  if (keyPoints.length === 0) {
    if (vehicle) keyPoints.push(vehicle);
    if (arrivalStop) keyPoints.push(arrivalStop);
    if (fullPolyline.length > 0) {
      keyPoints.push(...fullPolyline);
    }
  }

  // Default coordinate if everything is empty (Duke West Campus center fallback)
  const defaultCenter: Coordinates = { lat: 36.0014, lon: -78.9382 };

  let centerLat = defaultCenter.lat;
  let centerLon = defaultCenter.lon;
  let spanMeters = 600;

  if (keyPoints.length > 0) {
    let minLat = keyPoints[0]!.lat;
    let maxLat = keyPoints[0]!.lat;
    let minLon = keyPoints[0]!.lon;
    let maxLon = keyPoints[0]!.lon;

    for (let i = 1; i < keyPoints.length; i++) {
      const pt = keyPoints[i]!;
      if (pt.lat < minLat) minLat = pt.lat;
      if (pt.lat > maxLat) maxLat = pt.lat;
      if (pt.lon < minLon) minLon = pt.lon;
      if (pt.lon > maxLon) maxLon = pt.lon;
    }

    centerLat = (minLat + maxLat) / 2;
    centerLon = (minLon + maxLon) / 2;

    const metersPerDegLat = 111_000;
    const metersPerDegLon = 111_000 * Math.cos((centerLat * Math.PI) / 180);

    const deltaYMeters = (maxLat - minLat) * metersPerDegLat;
    const deltaXMeters = (maxLon - minLon) * metersPerDegLon;

    // Add 35% padding for breathing room around route and markers
    const rawSpan = Math.max(deltaXMeters, deltaYMeters) * 1.35;
    spanMeters = Math.max(
      MIN_VIEWPORT_SPAN_METERS,
      Math.min(MAX_VIEWPORT_SPAN_METERS, rawSpan),
    );
  }

  const metersPerDegLat = 111_000;
  const metersPerDegLon = 111_000 * Math.cos((centerLat * Math.PI) / 180);
  const pixelsPerMeter = SVG_DRAW_RADIUS / (spanMeters / 2);

  const project = (coord: Coordinates): ProjectedPoint => {
    const dxMeters = (coord.lon - centerLon) * metersPerDegLon;
    const dyMeters = (coord.lat - centerLat) * metersPerDegLat;
    return {
      x: SVG_CENTER + dxMeters * pixelsPerMeter,
      y: SVG_CENTER - dyMeters * pixelsPerMeter, // North is UP
    };
  };

  const getEdgeIndicator = (coord: Coordinates): EdgeIndicator => {
    const pt = project(coord);
    const isOffscreen =
      pt.x < SVG_INNER_MIN ||
      pt.x > SVG_INNER_MAX ||
      pt.y < SVG_INNER_MIN ||
      pt.y > SVG_INNER_MAX;

    if (!isOffscreen) {
      return {
        isOffscreen: false,
        edgeX: pt.x,
        edgeY: pt.y,
        angleDeg: 0,
      };
    }

    const dx = pt.x - SVG_CENTER;
    const dy = pt.y - SVG_CENTER;
    let t = Infinity;

    if (dx > 0) t = Math.min(t, (SVG_INNER_MAX - SVG_CENTER) / dx);
    else if (dx < 0) t = Math.min(t, (SVG_INNER_MIN - SVG_CENTER) / dx);

    if (dy > 0) t = Math.min(t, (SVG_INNER_MAX - SVG_CENTER) / dy);
    else if (dy < 0) t = Math.min(t, (SVG_INNER_MIN - SVG_CENTER) / dy);

    const edgeX = Math.max(
      SVG_INNER_MIN,
      Math.min(SVG_INNER_MAX, SVG_CENTER + dx * t),
    );
    const edgeY = Math.max(
      SVG_INNER_MIN,
      Math.min(SVG_INNER_MAX, SVG_CENTER + dy * t),
    );
    const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;

    return {
      isOffscreen: true,
      edgeX,
      edgeY,
      angleDeg,
    };
  };

  return {
    center: { lat: centerLat, lon: centerLon },
    spanMeters,
    pixelsPerMeter,
    project,
    getEdgeIndicator,
  };
}

/**
 * Converts a list of coordinates to an SVG polyline points attribute string.
 */
export function coordsToSvgPoints(
  coords: Coordinates[],
  project: (c: Coordinates) => ProjectedPoint,
): string {
  return coords
    .map((c) => {
      const p = project(c);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(' ');
}
