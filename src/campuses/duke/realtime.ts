import type {
  ArrivalPrediction,
  RealtimeProvider,
  RealtimeRoute,
  RealtimeSnapshot,
  VehiclePosition,
} from '../../core/types';
import {
  DUKE_TRANSLOC_ROUTES_URL,
  DUKE_TRANSLOC_VEHICLES_URL,
  parseTranslocRoutes,
  parseTranslocVehicles,
  type TranslocRouteResponse,
  type TranslocVehicleResponse,
} from './transloc';

const ROUTE_CACHE_MILLISECONDS = 15 * 60_000;

export class DukeRealtimeProvider implements RealtimeProvider {
  readonly available = true;
  private routes?: { value: RealtimeRoute[]; fetchedAt: number };
  private routeRequest?: Promise<RealtimeRoute[]>;
  private snapshotRequest?: Promise<RealtimeSnapshot>;

  constructor(private readonly fetcher: typeof fetch = fetch) {}

  private async getRoutes(signal?: AbortSignal): Promise<RealtimeRoute[]> {
    if (this.routes && Date.now() - this.routes.fetchedAt < ROUTE_CACHE_MILLISECONDS) {
      return this.routes.value;
    }
    if (this.routeRequest) return this.routeRequest;
    const previous = this.routes?.value;
    const request = this.fetcher(DUKE_TRANSLOC_ROUTES_URL, {
      cache: 'no-store',
      signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`TransLoc routes failed with HTTP ${response.status}`);
        const routes = parseTranslocRoutes((await response.json()) as TranslocRouteResponse[]);
        if (routes.length === 0) throw new Error('TransLoc returned no usable routes');
        this.routes = { value: routes, fetchedAt: Date.now() };
        return routes;
      })
      .catch((error: unknown) => {
        if (previous) return previous;
        throw error;
      });
    this.routeRequest = request;
    const clearRouteRequest = () => {
      if (this.routeRequest === request) this.routeRequest = undefined;
    };
    void request.then(clearRouteRequest, clearRouteRequest);
    return request;
  }

  async getSnapshot(signal?: AbortSignal): Promise<RealtimeSnapshot> {
    if (this.snapshotRequest) return this.snapshotRequest;
    const request = (async () => {
      const routesPromise = this.getRoutes(signal);
      const vehicleResponse = await this.fetcher(DUKE_TRANSLOC_VEHICLES_URL, {
        cache: 'no-store',
        signal,
      });
      if (!vehicleResponse.ok) {
        throw new Error(`TransLoc vehicles failed with HTTP ${vehicleResponse.status}`);
      }
      const receivedAt = new Date();
      const rawVehicles = (await vehicleResponse.json()) as TranslocVehicleResponse[];
      const routes = await routesPromise;
      return {
        receivedAt,
        routes,
        vehicles: parseTranslocVehicles(rawVehicles, routes, receivedAt),
      };
    })();
    this.snapshotRequest = request;
    const clearSnapshotRequest = () => {
      if (this.snapshotRequest === request) this.snapshotRequest = undefined;
    };
    void request.then(clearSnapshotRequest, clearSnapshotRequest);
    return request;
  }

  async getVehiclePositions(): Promise<VehiclePosition[]> {
    return (await this.getSnapshot()).vehicles;
  }

  async getArrivalPredictions(): Promise<ArrivalPrediction[]> {
    return [];
  }
}
