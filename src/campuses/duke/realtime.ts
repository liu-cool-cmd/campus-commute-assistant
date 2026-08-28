import type { ArrivalPrediction, RealtimeProvider, VehiclePosition } from '../../core/types';

/**
 * TransLoc advertises rider-facing realtime, but no current, documented, keyless API contract was
 * found for third-party clients. Keeping this provider unavailable prevents accidental dependence
 * on private browser endpoints while preserving the cross-campus contract for a verified feed.
 */
export class DukeRealtimeProvider implements RealtimeProvider {
  readonly available = false;

  async getVehiclePositions(): Promise<VehiclePosition[]> {
    return [];
  }

  async getArrivalPredictions(): Promise<ArrivalPrediction[]> {
    return [];
  }
}
