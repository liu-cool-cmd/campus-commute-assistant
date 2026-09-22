import { describe, expect, it } from 'vitest';
import {
  createMiniMapProjection,
  coordsToSvgPoints,
  MAX_VIEWPORT_SPAN_METERS,
  MIN_VIEWPORT_SPAN_METERS,
  SVG_CENTER,
  SVG_INNER_MAX,
  SVG_INNER_MIN,
} from './miniRouteMapMath';
import type { Coordinates } from '../core/types';

describe('miniRouteMapMath', () => {
  it('projects North-Up correctly (higher latitude means smaller SVG Y, higher longitude means larger SVG X)', () => {
    const northPt: Coordinates = { lat: 36.002, lon: -78.9 };
    const southPt: Coordinates = { lat: 35.998, lon: -78.9 };
    const eastPt: Coordinates = { lat: 36.0, lon: -78.898 };
    const westPt: Coordinates = { lat: 36.0, lon: -78.902 };

    const projection = createMiniMapProjection({
      fullPolyline: [northPt, southPt, eastPt, westPt],
    });

    const northSvg = projection.project(northPt);
    const southSvg = projection.project(southPt);
    const eastSvg = projection.project(eastPt);
    const westSvg = projection.project(westPt);

    // North is UP (smaller Y in SVG)
    expect(northSvg.y).toBeLessThan(SVG_CENTER);
    expect(southSvg.y).toBeGreaterThan(SVG_CENTER);

    // East is RIGHT (larger X in SVG)
    expect(eastSvg.x).toBeGreaterThan(SVG_CENTER);
    expect(westSvg.x).toBeLessThan(SVG_CENTER);
  });

  it('preserves isotropic 1:1 metric distance (distance North equals distance East in pixels)', () => {
    const origin: Coordinates = { lat: 36.0, lon: -78.9 };
    // At Duke lat (36°), 1 degree lat ≈ 111,000m, 1 degree lon ≈ 111,000 * cos(36°) ≈ 89,800m
    const degLatFor100m = 100 / 111_000;
    const degLonFor100m = 100 / (111_000 * Math.cos((36.0 * Math.PI) / 180));

    const north100m: Coordinates = { lat: 36.0 + degLatFor100m, lon: -78.9 };
    const east100m: Coordinates = { lat: 36.0, lon: -78.9 + degLonFor100m };

    const projection = createMiniMapProjection({
      fullPolyline: [origin, north100m, east100m],
    });

    const originSvg = projection.project(origin);
    const northSvg = projection.project(north100m);
    const eastSvg = projection.project(east100m);

    const pixelDistNorth = Math.abs(northSvg.y - originSvg.y);
    const pixelDistEast = Math.abs(eastSvg.x - originSvg.x);

    expect(pixelDistNorth).toBeCloseTo(pixelDistEast, 1);
  });

  it('clamps viewport span between MIN_VIEWPORT_SPAN_METERS and MAX_VIEWPORT_SPAN_METERS', () => {
    // 1. Tiny distance (e.g. 50 meters)
    const tinyProjection = createMiniMapProjection({
      boardingStop: { id: 'b', name: 'Board', lat: 36.0, lon: -78.9, order: 1 },
      vehicle: {
        vehicleId: 'v',
        lat: 36.0001,
        lon: -78.9,
        gpsAgeSeconds: 5,
        isOnRoute: true,
        recordedAt: new Date(),
      },
    });
    expect(tinyProjection.spanMeters).toBeGreaterThanOrEqual(MIN_VIEWPORT_SPAN_METERS);

    // 2. Huge distance (e.g. 10 km) - should not zoom out beyond MAX_VIEWPORT_SPAN_METERS
    const hugeProjection = createMiniMapProjection({
      boardingStop: { id: 'b', name: 'Board', lat: 36.0, lon: -78.9, order: 1 },
      vehicle: {
        vehicleId: 'v',
        lat: 36.09,
        lon: -78.9,
        gpsAgeSeconds: 5,
        isOnRoute: true,
        recordedAt: new Date(),
      },
    });
    expect(hugeProjection.spanMeters).toBeLessThanOrEqual(MAX_VIEWPORT_SPAN_METERS);
  });

  it('correctly calculates edge indicators for offscreen coordinates', () => {
    const boarding: Coordinates = { lat: 36.0, lon: -78.9 };
    // Vehicle is far away to the North-East
    const farVehicle: Coordinates = { lat: 36.05, lon: -78.85 };

    const projection = createMiniMapProjection({
      boardingStop: { id: 'b', name: 'Board', lat: boarding.lat, lon: boarding.lon, order: 1 },
      vehicle: {
        vehicleId: 'v',
        lat: farVehicle.lat,
        lon: farVehicle.lon,
        gpsAgeSeconds: 5,
        isOnRoute: true,
        recordedAt: new Date(),
      },
    });

    const indicator = projection.getEdgeIndicator(farVehicle);
    expect(indicator.isOffscreen).toBe(true);
    // Should be on the top or right edge
    expect(indicator.edgeX).toBeGreaterThanOrEqual(SVG_INNER_MIN);
    expect(indicator.edgeX).toBeLessThanOrEqual(SVG_INNER_MAX);
    expect(indicator.edgeY).toBeGreaterThanOrEqual(SVG_INNER_MIN);
    expect(indicator.edgeY).toBeLessThanOrEqual(SVG_INNER_MAX);
    // Should be at the edge perimeter (either edgeX == SVG_INNER_MAX or edgeY == SVG_INNER_MIN)
    const onPerimeter =
      indicator.edgeX === SVG_INNER_MAX ||
      indicator.edgeX === SVG_INNER_MIN ||
      indicator.edgeY === SVG_INNER_MAX ||
      indicator.edgeY === SVG_INNER_MIN;
    expect(onPerimeter).toBe(true);
  });

  it('formats coordinates to SVG points string', () => {
    const projection = createMiniMapProjection({
      fullPolyline: [
        { lat: 36.0, lon: -78.9 },
        { lat: 36.002, lon: -78.898 },
      ],
    });
    const pointsStr = coordsToSvgPoints(
      [
        { lat: 36.0, lon: -78.9 },
        { lat: 36.002, lon: -78.898 },
      ],
      projection.project,
    );
    expect(pointsStr).toMatch(/^\d+\.\d+,\d+\.\d+ \d+\.\d+,\d+\.\d+$/);
  });
});
