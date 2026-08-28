import { describe, expect, it, vi } from 'vitest';
import { DukeRealtimeProvider } from './realtime';
import {
  DUKE_TRANSLOC_ROUTES_URL,
  DUKE_TRANSLOC_VEHICLES_URL,
  makeTranslocSnapshot,
  type TranslocRouteResponse,
  type TranslocVehicleResponse,
} from './transloc';

const routes: TranslocRouteResponse[] = [
  {
    RouteID: 13,
    GtfsId: 'TL-13',
    Description: 'LLCCW',
    EncodedPolyline: '_ocsE~kbpN?o}@o}@?',
    MapLineColor: '123C31',
    IsRunning: true,
    Stops: [
      {
        RouteStopID: 1,
        AddressID: 1,
        GtfsId: 'TL-200',
        Name: 'Duke Clinic',
        Order: 10,
        Latitude: 36,
        Longitude: -78.94,
      },
    ],
  },
];

const vehicles: TranslocVehicleResponse[] = [
  {
    VehicleID: 26,
    Name: 'DU 1530',
    RouteID: 13,
    Latitude: 36,
    Longitude: -78.935,
    Heading: 360,
    GroundSpeed: 25,
    Seconds: 17,
    TimeStamp: '/Date(0-0600)/',
    IsOnRoute: true,
    IsDelayed: false,
  },
  {
    VehicleID: 99,
    Name: 'Unknown route',
    RouteID: 999,
    Latitude: 36,
    Longitude: -78.935,
    Heading: 90,
    GroundSpeed: 1,
    Seconds: 2,
    TimeStamp: '/Date(0-0600)/',
    IsOnRoute: true,
    IsDelayed: false,
  },
];

describe('Duke TransLoc adapter', () => {
  it('maps vehicles only through numeric RouteID to the route GtfsId', () => {
    const receivedAt = new Date('2026-08-28T12:00:00Z');
    const snapshot = makeTranslocSnapshot(routes, vehicles, receivedAt);

    expect(snapshot.routes[0]).toMatchObject({
      providerRouteId: '13',
      routeId: 'TL-13',
      color: '#123C31',
    });
    expect(snapshot.vehicles).toHaveLength(1);
    expect(snapshot.vehicles[0]).toMatchObject({
      vehicleId: '26',
      providerRouteId: '13',
      routeId: 'TL-13',
      bearing: 0,
      gpsAgeSeconds: 17,
    });
    expect(snapshot.vehicles[0]!.recordedAt.toISOString()).toBe('2026-08-28T11:59:43.000Z');
  });

  it('caches route metadata while refreshing vehicle snapshots', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      const value = String(url);
      if (value === DUKE_TRANSLOC_ROUTES_URL) return Response.json(routes);
      if (value === DUKE_TRANSLOC_VEHICLES_URL) return Response.json(vehicles);
      return new Response('', { status: 404 });
    });
    const provider = new DukeRealtimeProvider(fetcher as typeof fetch);

    await provider.getSnapshot();
    await provider.getSnapshot();

    expect(
      fetcher.mock.calls.filter(([url]) => String(url) === DUKE_TRANSLOC_ROUTES_URL),
    ).toHaveLength(1);
    expect(
      fetcher.mock.calls.filter(([url]) => String(url) === DUKE_TRANSLOC_VEHICLES_URL),
    ).toHaveLength(2);
  });
});
