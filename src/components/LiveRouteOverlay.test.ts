import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { LiveTripProgress } from '../core/realtime/routeProgress';
import { LiveRouteOverlay } from './LiveRouteOverlay';

vi.mock('leaflet', () => ({
  divIcon: vi.fn(({ className, html }: { className?: string; html?: string }) => ({
    className,
    html,
  })),
  latLngBounds: vi.fn((locations: unknown) => ({
    locations,
    pad: () => ({ contains: () => true }),
  })),
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, className }: { children: React.ReactNode; className?: string }) =>
    createElement('div', { className, 'data-testid': 'mini-map' }, children),
  TileLayer: () => createElement('div', { 'data-testid': 'tile-layer' }),
  Polyline: ({
    pathOptions,
  }: {
    positions: unknown;
    pathOptions?: { color?: string };
  }) =>
    createElement('div', {
      'data-testid': 'polyline',
      'data-color': pathOptions?.color,
    }),
  CircleMarker: ({
    pathOptions,
  }: {
    center: unknown;
    pathOptions?: { color?: string; fillColor?: string };
  }) =>
    createElement('div', {
      'data-testid': 'circle-marker',
      'data-color': pathOptions?.color,
      'data-fill': pathOptions?.fillColor,
    }),
  Marker: ({
    position,
  }: {
    position: [number, number];
    icon: unknown;
  }) =>
    createElement('div', {
      'data-testid': 'marker',
      'data-pos': position.join(','),
    }),
  useMap: () => ({
    fitBounds: vi.fn(),
    flyToBounds: vi.fn(),
    getBounds: vi.fn(() => ({ pad: () => ({ contains: () => true }) })),
  }),
}));

describe('LiveRouteOverlay', () => {
  const baseProgress: LiveTripProgress = {
    status: 'live',
    route: {
      routeId: 'route-c1',
      providerRouteId: '1',
      name: 'C1 East-West',
      isLoop: false,
      polyline: [
        { lat: 36.001, lon: -78.938 },
        { lat: 36.003, lon: -78.936 },
        { lat: 36.005, lon: -78.934 },
      ],
      stops: [
        { id: 'stop-board', name: 'East Campus', lat: 36.001, lon: -78.938, order: 1 },
        { id: 'stop-arrive', name: 'West Campus', lat: 36.005, lon: -78.934, order: 2 },
      ],
    },
    vehicle: {
      vehicleId: 'bus-1',
      name: 'DU 1520',
      routeId: 'route-c1',
      providerRouteId: '1',
      lat: 36.0005,
      lon: -78.9385,
      bearing: 45,
      groundSpeed: 10,
      gpsAgeSeconds: 8,
      isOnRoute: true,
      recordedAt: new Date(Date.now() - 8_000),
    },
    boardingStop: { id: 'stop-board', name: 'East Campus', lat: 36.001, lon: -78.938, order: 1 },
    arrivalStop: { id: 'stop-arrive', name: 'West Campus', lat: 36.005, lon: -78.934, order: 2 },
    vehicleToBoardingPath: [
      { lat: 36.0005, lon: -78.9385 },
      { lat: 36.001, lon: -78.938 },
    ],
    boardingToArrivalPath: [
      { lat: 36.001, lon: -78.938 },
      { lat: 36.003, lon: -78.936 },
      { lat: 36.005, lon: -78.934 },
    ],
    passedPath: [],
    displayStops: [],
    distanceToBoardingMeters: 450,
    distanceBoardingToArrivalMeters: 1200,
    stopsAway: 2,
    gpsAgeSeconds: 8,
  };

  it('renders Leaflet mini map with OpenStreetMap, Compass badge, and live metrics', () => {
    const html = renderToStaticMarkup(
      createElement(LiveRouteOverlay, {
        language: 'en',
        routeName: 'C1',
        progress: baseProgress,
        onOpen: vi.fn(),
      }),
    );

    // Header & Live status
    expect(html).toContain('C1');
    expect(html).toContain('live-dot');
    expect(html).toContain('Live');

    // Leaflet structure
    expect(html).toContain('live-route-mini-map');
    expect(html).toContain('tile-layer');
    expect(html).toContain('data-testid="marker"');

    // North compass badge
    expect(html).toContain('live-mini-map-compass');
    expect(html).toContain('N ↑');

    // Metrics
    expect(html).toContain('2 stops · 0.3 mi away');
    expect(html).toMatch(/GPS updated [7-9]s ago/);
    expect(html).toContain('Tap map to open full route');
  });

  it('renders fallback badge and last known position label when isFallback is active', () => {
    const fallbackProgress: LiveTripProgress = {
      ...baseProgress,
      status: 'stale',
      reason: 'stale-gps',
      isFallback: true,
      gpsAgeSeconds: 22,
      vehicle: {
        ...baseProgress.vehicle!,
        recordedAt: new Date(Date.now() - 22_000),
      },
    };

    const html = renderToStaticMarkup(
      createElement(LiveRouteOverlay, {
        language: 'zh-CN',
        routeName: 'C1',
        progress: fallbackProgress,
        onOpen: vi.fn(),
      }),
    );

    expect(html).toContain('位置暂未更新');
    expect(html).toMatch(/最后定位于 2[1-3] 秒前/);
    expect(html).toContain('status-stale');
  });

  it('renders stale GPS status badge when progress status is stale without fallback', () => {
    const staleProgress: LiveTripProgress = {
      ...baseProgress,
      status: 'stale',
      gpsAgeSeconds: 72,
    };

    const html = renderToStaticMarkup(
      createElement(LiveRouteOverlay, {
        language: 'en',
        routeName: 'C1',
        progress: staleProgress,
        onOpen: vi.fn(),
      }),
    );

    expect(html).toContain('STALE GPS');
    expect(html).toContain('status-stale');
  });
});
