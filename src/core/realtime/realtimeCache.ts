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
