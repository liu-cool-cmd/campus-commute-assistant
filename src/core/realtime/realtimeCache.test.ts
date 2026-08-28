import { describe, expect, it, vi } from 'vitest';
import type { RealtimeProvider, RealtimeSnapshot } from '../types';
import { RealtimeSnapshotCache } from './realtimeCache';

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
});
