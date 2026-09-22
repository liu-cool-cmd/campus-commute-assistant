import { describe, expect, it, vi } from 'vitest';
import type { RealtimeProvider, RealtimeSnapshot } from '../types';
import { isRealtimeSnapshotIdentical, RealtimeSnapshotCache } from './realtimeCache';

describe('RealtimeSnapshotCache', () => {
  it('deduplicates concurrent refreshes and retains the last snapshot', async () => {
    const snapshot: RealtimeSnapshot = {
      receivedAt: new Date('2026-08-28T12:00:00Z'),
      routes: [],
      vehicles: [],
    };
    let resolveRequest!: (value: RealtimeSnapshot) => void;
    const request = new Promise<RealtimeSnapshot>((resolve) => {
      resolveRequest = resolve;
    });
    const provider: RealtimeProvider = {
      available: true,
      getSnapshot: vi.fn(() => request),
      getVehiclePositions: vi.fn(async () => []),
      getArrivalPredictions: vi.fn(async () => []),
    };
    const cache = new RealtimeSnapshotCache(provider);

    const first = cache.refresh();
    const second = cache.refresh();
    expect(provider.getSnapshot).toHaveBeenCalledTimes(1);
    resolveRequest(snapshot);

    await expect(first).resolves.toBe(snapshot);
    await expect(second).resolves.toBe(snapshot);
    expect(cache.current).toBe(snapshot);
  });

  it('correctly compares realtime snapshots and preserves freshness for stationary vehicles', () => {
    const route = {
      routeId: 'r1',
      providerRouteId: '1',
      name: 'R1',
      isLoop: false,
      polyline: [],
      stops: [],
    };
    const snap1: RealtimeSnapshot = {
      receivedAt: new Date('2026-08-28T12:00:00Z'),
      routes: [route],
      vehicles: [
        {
          vehicleId: 'v1',
          lat: 36.0,
          lon: -78.9,
          bearing: 90,
          groundSpeed: 0,
          gpsAgeSeconds: 10,
          recordedAt: new Date('2026-08-28T11:59:50Z'),
          isOnRoute: true,
        },
      ],
    };

    // Identical copy
    const snapIdentical: RealtimeSnapshot = {
      receivedAt: new Date('2026-08-28T12:00:05Z'),
      routes: [route],
      vehicles: [
        {
          vehicleId: 'v1',
          lat: 36.0,
          lon: -78.9,
          bearing: 90,
          groundSpeed: 0,
          gpsAgeSeconds: 10,
          recordedAt: new Date('2026-08-28T11:59:50Z'),
          isOnRoute: true,
        },
      ],
    };
    expect(isRealtimeSnapshotIdentical(snap1, snapIdentical)).toBe(true);

    // Vehicle stationary at same lat/lon, but a fresh observation arrived with updated timestamp/age
    const snapFreshObservation: RealtimeSnapshot = {
      receivedAt: new Date('2026-08-28T12:00:10Z'),
      routes: [route],
      vehicles: [
        {
          vehicleId: 'v1',
          lat: 36.0,
          lon: -78.9,
          bearing: 90,
          groundSpeed: 0,
          gpsAgeSeconds: 4, // fresher age
          recordedAt: new Date('2026-08-28T12:00:06Z'), // newer recordedAt
          isOnRoute: true,
        },
      ],
    };
    // Must NOT be considered identical, ensuring freshness is preserved!
    expect(isRealtimeSnapshotIdentical(snap1, snapFreshObservation)).toBe(false);

    // Vehicle moved
    const snapMoved: RealtimeSnapshot = {
      receivedAt: new Date('2026-08-28T12:00:10Z'),
      routes: [route],
      vehicles: [
        {
          vehicleId: 'v1',
          lat: 36.001,
          lon: -78.9,
          bearing: 90,
          groundSpeed: 5,
          gpsAgeSeconds: 10,
          recordedAt: new Date('2026-08-28T11:59:50Z'),
          isOnRoute: true,
        },
      ],
    };
    expect(isRealtimeSnapshotIdentical(snap1, snapMoved)).toBe(false);
  });
});

