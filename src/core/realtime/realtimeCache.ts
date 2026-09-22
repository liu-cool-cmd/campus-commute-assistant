import type { RealtimeProvider, RealtimeSnapshot } from '../types';

export class RealtimeSnapshotCache {
  private snapshot?: RealtimeSnapshot;
  private inFlight?: Promise<RealtimeSnapshot>;

  constructor(private readonly provider: RealtimeProvider) {}

  get current(): RealtimeSnapshot | undefined {
    return this.snapshot;
  }

  refresh(signal?: AbortSignal): Promise<RealtimeSnapshot> {
    if (this.inFlight) return this.inFlight;
    const request = this.provider.getSnapshot(signal).then((snapshot) => {
      this.snapshot = snapshot;
      return snapshot;
    });
    this.inFlight = request;
    const clear = () => {
      if (this.inFlight === request) this.inFlight = undefined;
    };
    void request.then(clear, clear);
    return request;
  }
}

export function isRealtimeSnapshotIdentical(
  prev?: RealtimeSnapshot,
  next?: RealtimeSnapshot,
): boolean {
  if (!prev || !next) return false;
  if (prev === next) return true;
  if (prev.routes !== next.routes) {
    if (prev.routes.length !== next.routes.length) return false;
    for (let i = 0; i < prev.routes.length; i++) {
      if (prev.routes[i]!.routeId !== next.routes[i]!.routeId) return false;
    }
  }
  if (prev.vehicles.length !== next.vehicles.length) return false;
  for (let i = 0; i < prev.vehicles.length; i++) {
    const a = prev.vehicles[i]!;
    const b = next.vehicles[i]!;
    if (
      a.vehicleId !== b.vehicleId ||
      a.lat !== b.lat ||
      a.lon !== b.lon ||
      a.bearing !== b.bearing ||
      a.groundSpeed !== b.groundSpeed ||
      a.gpsAgeSeconds !== b.gpsAgeSeconds ||
      a.recordedAt.getTime() !== b.recordedAt.getTime() ||
      a.isOnRoute !== b.isOnRoute ||
      a.isDelayed !== b.isDelayed
    ) {
      return false;
    }
  }
  return true;
}

