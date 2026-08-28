import type {
  Coordinates,
  RealtimeRoute,
  RealtimeRouteStop,
  RealtimeSnapshot,
  VehiclePosition,
} from '../types';

const EARTH_RADIUS_METERS = 6_371_000;
const PROJECTION_TIE_METERS = 8;
const PROJECTION_SEPARATION_METERS = 60;
const MAX_OFF_ROUTE_METERS = 80;
const STOP_ORDER_TOLERANCE_METERS = 40;
const HEADING_MISMATCH_DEGREES = 100;

export interface RouteProjection {
  segmentIndex: number;
  segmentFraction: number;
  distanceAlongRouteMeters: number;
  distanceFromRouteMeters: number;
  projectedLocation: Coordinates;
  segmentBearing: number;
}

export interface LiveTripStopProgress {
  stop: RealtimeRouteStop;
  distanceFromVehicleMeters: number;
  role: 'intermediate' | 'boarding' | 'arrival';
}

export interface LiveTripProgress {
  status: 'live' | 'stale' | 'unavailable' | 'ambiguous';
  reason?:
    | 'route-not-found'
    | 'stop-not-found'
    | 'invalid-route-order'
    | 'no-active-vehicle'
    | 'stale-gps'
    | 'ambiguous-projection'
    | 'seam-crossing';
  route?: RealtimeRoute;
  vehicle?: VehiclePosition;
  boardingStop?: RealtimeRouteStop;
  arrivalStop?: RealtimeRouteStop;
  vehicleProjection?: RouteProjection;
  boardingProjection?: RouteProjection;
  arrivalProjection?: RouteProjection;
  distanceToBoardingMeters?: number;
  distanceBoardingToArrivalMeters?: number;
  stopsAway?: number;
  gpsAgeSeconds?: number;
  vehicleToBoardingPath: Coordinates[];
  boardingToArrivalPath: Coordinates[];
  passedPath: Coordinates[];
  displayStops: LiveTripStopProgress[];
}

type ProjectionCandidate = RouteProjection;

interface PreparedRoute {
  cumulative: number[];
  length: number;
  isLoop: boolean;
}

interface StopMatchState {
  projections: RouteProjection[];
  unwrappedDistances: number[];
  wraps: number;
  cost: number;
  startDistance: number;
}

const radians = (degrees: number) => (degrees * Math.PI) / 180;
const degrees = (value: number) => (value * 180) / Math.PI;

export function distanceMeters(left: Coordinates, right: Coordinates): number {
  const latitudeDelta = radians(right.lat - left.lat);
  const longitudeDelta = radians(right.lon - left.lon);
  const leftLatitude = radians(left.lat);
  const rightLatitude = radians(right.lat);
  const value =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(leftLatitude) * Math.cos(rightLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function bearing(start: Coordinates, end: Coordinates): number {
  const startLatitude = radians(start.lat);
  const endLatitude = radians(end.lat);
  const longitudeDelta = radians(end.lon - start.lon);
  const y = Math.sin(longitudeDelta) * Math.cos(endLatitude);
  const x =
    Math.cos(startLatitude) * Math.sin(endLatitude) -
    Math.sin(startLatitude) * Math.cos(endLatitude) * Math.cos(longitudeDelta);
  return (degrees(Math.atan2(y, x)) + 360) % 360;
}

function headingDifference(left: number, right: number): number {
  const difference = Math.abs(((left - right + 540) % 360) - 180);
  return difference;
}

function prepareRoute(polyline: Coordinates[], isLoop: boolean): PreparedRoute | undefined {
  if (polyline.length < 2) return undefined;
  const cumulative = [0];
  for (let index = 1; index < polyline.length; index += 1) {
    cumulative.push(
      cumulative[index - 1]! + distanceMeters(polyline[index - 1]!, polyline[index]!),
    );
  }
  const length = cumulative.at(-1) ?? 0;
  return length > 0 ? { cumulative, length, isLoop } : undefined;
}

function projectionCandidates(
  point: Coordinates,
  polyline: Coordinates[],
  prepared: PreparedRoute,
): ProjectionCandidate[] {
  const referenceLatitude = radians(point.lat);
  const toLocal = (value: Coordinates) => ({
    x: radians(value.lon - point.lon) * EARTH_RADIUS_METERS * Math.cos(referenceLatitude),
    y: radians(value.lat - point.lat) * EARTH_RADIUS_METERS,
  });

  const candidates: ProjectionCandidate[] = [];
  for (let index = 0; index < polyline.length - 1; index += 1) {
    const start = polyline[index]!;
    const end = polyline[index + 1]!;
    const localStart = toLocal(start);
    const localEnd = toLocal(end);
    const dx = localEnd.x - localStart.x;
    const dy = localEnd.y - localStart.y;
    const lengthSquared = dx * dx + dy * dy;
    const fraction =
      lengthSquared === 0
        ? 0
        : Math.max(0, Math.min(1, -(localStart.x * dx + localStart.y * dy) / lengthSquared));
    const projectedX = localStart.x + fraction * dx;
    const projectedY = localStart.y + fraction * dy;
    const segmentLength = prepared.cumulative[index + 1]! - prepared.cumulative[index]!;
    candidates.push({
      segmentIndex: index,
      segmentFraction: fraction,
      distanceAlongRouteMeters: prepared.cumulative[index]! + fraction * segmentLength,
      distanceFromRouteMeters: Math.hypot(projectedX, projectedY),
      projectedLocation: {
        lat: start.lat + (end.lat - start.lat) * fraction,
        lon: start.lon + (end.lon - start.lon) * fraction,
      },
      segmentBearing: bearing(start, end),
    });
  }
  return candidates.sort(
    (left, right) => left.distanceFromRouteMeters - right.distanceFromRouteMeters,
  );
}

export function projectPointToRoute(
  point: Coordinates,
  polyline: Coordinates[],
  options: { isLoop?: boolean; heading?: number } = {},
): RouteProjection | undefined {
  const prepared = prepareRoute(polyline, options.isLoop ?? false);
  if (!prepared) return undefined;
  const candidates = projectionCandidates(point, polyline, prepared);
  const closest = candidates[0];
  if (!closest || closest.distanceFromRouteMeters > MAX_OFF_ROUTE_METERS) return undefined;

  const tied = candidates.filter(
    (candidate) =>
      candidate.distanceFromRouteMeters <=
        closest.distanceFromRouteMeters + PROJECTION_TIE_METERS &&
      Math.abs(candidate.distanceAlongRouteMeters - closest.distanceAlongRouteMeters) >=
        PROJECTION_SEPARATION_METERS,
  );
  if (tied.length === 0) return closest;
  if (options.heading === undefined || !Number.isFinite(options.heading)) return undefined;

  const headingCandidates = [closest, ...tied].sort(
    (left, right) =>
      headingDifference(options.heading!, left.segmentBearing) -
      headingDifference(options.heading!, right.segmentBearing),
  );
  const winner = headingCandidates[0]!;
  const runnerUp = headingCandidates[1]!;
  return headingDifference(options.heading, winner.segmentBearing) <= 70 &&
    headingDifference(options.heading, runnerUp.segmentBearing) -
      headingDifference(options.heading, winner.segmentBearing) >=
      25
    ? winner
    : undefined;
}

export function directedCyclicDistance(
  fromDistance: number,
  toDistance: number,
  routeLength: number,
): number {
  if (routeLength <= 0) return Number.NaN;
  return (((toDistance - fromDistance) % routeLength) + routeLength) % routeLength;
}

export function unwrapCyclicDistances(
  distances: number[],
  routeLength: number,
  toleranceMeters = STOP_ORDER_TOLERANCE_METERS,
): number[] | undefined {
  if (distances.length === 0 || routeLength <= 0) return [];
  const result = [distances[0]!];
  let wraps = 0;
  for (let index = 1; index < distances.length; index += 1) {
    let candidate = distances[index]! + wraps * routeLength;
    if (candidate + toleranceMeters < result[index - 1]!) {
      wraps += 1;
      if (wraps > 1) return undefined;
      candidate += routeLength;
    }
    if (candidate + toleranceMeters < result[index - 1]!) return undefined;
    result.push(Math.max(candidate, result[index - 1]!));
  }
  return result;
}

function candidateStops(
  stop: RealtimeRouteStop,
  polyline: Coordinates[],
  prepared: PreparedRoute,
): RouteProjection[] {
  const candidates = projectionCandidates(stop, polyline, prepared);
  const closest = candidates[0];
  if (!closest || closest.distanceFromRouteMeters > MAX_OFF_ROUTE_METERS) return [];
  const threshold = Math.min(
    MAX_OFF_ROUTE_METERS,
    Math.max(25, closest.distanceFromRouteMeters + 18),
  );
  const result: RouteProjection[] = [];
  for (const candidate of candidates) {
    if (candidate.distanceFromRouteMeters > threshold) break;
    const duplicateIndex = result.findIndex(
      (item) => Math.abs(item.distanceAlongRouteMeters - candidate.distanceAlongRouteMeters) < 12,
    );
    if (duplicateIndex < 0) result.push(candidate);
    else if (candidate.distanceFromRouteMeters < result[duplicateIndex]!.distanceFromRouteMeters) {
      result[duplicateIndex] = candidate;
    }
  }
  return result;
}

function matchOrderedStops(
  stops: RealtimeRouteStop[],
  polyline: Coordinates[],
  prepared: PreparedRoute,
): { projections: RouteProjection[]; unwrappedDistances: number[] } | undefined {
  const candidatesByStop = stops.map((stop) => candidateStops(stop, polyline, prepared));
  if (candidatesByStop.some((candidates) => candidates.length === 0)) return undefined;
  let states: StopMatchState[] = candidatesByStop[0]!.map((projection) => ({
    projections: [projection],
    unwrappedDistances: [projection.distanceAlongRouteMeters],
    wraps: 0,
    cost: projection.distanceFromRouteMeters ** 2,
    startDistance: projection.distanceAlongRouteMeters,
  }));

  for (let stopIndex = 1; stopIndex < candidatesByStop.length; stopIndex += 1) {
    const nextStates: StopMatchState[] = [];
    for (const state of states) {
      const previous = state.unwrappedDistances.at(-1)!;
      for (const projection of candidatesByStop[stopIndex]!) {
        let wraps = state.wraps;
        let unwrapped = projection.distanceAlongRouteMeters + wraps * prepared.length;
        if (unwrapped + STOP_ORDER_TOLERANCE_METERS < previous) {
          if (!prepared.isLoop || wraps >= 1) continue;
          wraps += 1;
          unwrapped += prepared.length;
        }
        if (
          unwrapped + STOP_ORDER_TOLERANCE_METERS < previous ||
          unwrapped > state.startDistance + prepared.length + STOP_ORDER_TOLERANCE_METERS
        ) {
          continue;
        }
        nextStates.push({
          projections: [...state.projections, projection],
          unwrappedDistances: [...state.unwrappedDistances, Math.max(previous, unwrapped)],
          wraps,
          cost:
            state.cost +
            projection.distanceFromRouteMeters ** 2 +
            Math.max(0, unwrapped - previous) * 0.0001,
          startDistance: state.startDistance,
        });
      }
    }
    if (nextStates.length === 0) return undefined;
    // Keep the best state for each approximate progress/wrap bucket to prevent repeated parallel
    // segments from growing the search exponentially.
    const bestByBucket = new Map<string, StopMatchState>();
    for (const state of nextStates) {
      const bucket = `${state.wraps}:${Math.round(state.unwrappedDistances.at(-1)! / 10)}`;
      const previous = bestByBucket.get(bucket);
      if (!previous || state.cost < previous.cost) bestByBucket.set(bucket, state);
    }
    states = [...bestByBucket.values()].sort((left, right) => left.cost - right.cost).slice(0, 80);
  }

  const best = states.sort((left, right) => left.cost - right.cost)[0];
  return best
    ? { projections: best.projections, unwrappedDistances: best.unwrappedDistances }
    : undefined;
}

function interpolateOnSegment(start: Coordinates, end: Coordinates, fraction: number): Coordinates {
  return {
    lat: start.lat + (end.lat - start.lat) * fraction,
    lon: start.lon + (end.lon - start.lon) * fraction,
  };
}

function pointAtDistance(
  polyline: Coordinates[],
  prepared: PreparedRoute,
  distance: number,
): Coordinates {
  const normalized = Math.max(0, Math.min(prepared.length, distance));
  let index = 0;
  while (index < prepared.cumulative.length - 2 && prepared.cumulative[index + 1]! < normalized) {
    index += 1;
  }
  const startDistance = prepared.cumulative[index]!;
  const endDistance = prepared.cumulative[index + 1]!;
  const fraction =
    endDistance === startDistance
      ? 0
      : (normalized - startDistance) / (endDistance - startDistance);
  return interpolateOnSegment(polyline[index]!, polyline[index + 1]!, fraction);
}

function sliceForward(
  polyline: Coordinates[],
  prepared: PreparedRoute,
  from: number,
  to: number,
): Coordinates[] {
  if (to < from && prepared.isLoop) {
    const first = sliceForward(polyline, prepared, from, prepared.length);
    const second = sliceForward(polyline, prepared, 0, to);
    return [...first, ...second.slice(1)];
  }
  if (to < from) return [];
  const result = [pointAtDistance(polyline, prepared, from)];
  for (let index = 1; index < polyline.length - 1; index += 1) {
    const distance = prepared.cumulative[index]!;
    if (distance > from && distance < to) result.push(polyline[index]!);
  }
  result.push(pointAtDistance(polyline, prepared, to));
  return result;
}

function unavailable(
  status: LiveTripProgress['status'],
  reason: LiveTripProgress['reason'],
  route?: RealtimeRoute,
): LiveTripProgress {
  return {
    status,
    reason,
    route,
    vehicleToBoardingPath: [],
    boardingToArrivalPath: [],
    passedPath: [],
    displayStops: [],
  };
}

export function calculateLiveTripProgress(options: {
  snapshot: RealtimeSnapshot;
  routeId: string;
  boardingStopId: string;
  arrivalStopId: string;
  now?: Date;
  staleAfterSeconds?: number;
}): LiveTripProgress {
  const { snapshot, routeId, boardingStopId, arrivalStopId } = options;
  const now = options.now ?? new Date();
  const staleAfterSeconds = options.staleAfterSeconds ?? 90;
  const route = snapshot.routes.find((item) => item.routeId === routeId);
  if (!route) return unavailable('unavailable', 'route-not-found');
  const prepared = prepareRoute(route.polyline, route.isLoop);
  if (!prepared) return unavailable('ambiguous', 'invalid-route-order', route);

  const boardingStop = route.stops.find((stop) => stop.id === boardingStopId);
  const arrivalStop = route.stops.find((stop) => stop.id === arrivalStopId);
  if (!boardingStop || !arrivalStop) return unavailable('unavailable', 'stop-not-found', route);

  const orderedStops = [...route.stops].sort((left, right) => left.order - right.order);
  // Ordered metadata disambiguates repeated and self-crossing line segments. Vehicles remain
  // subject to the stricter single-point/heading check below.
  const stopMatch = matchOrderedStops(orderedStops, route.polyline, prepared);
  if (!stopMatch) {
    return unavailable('ambiguous', 'invalid-route-order', route);
  }
  const stopProjections = stopMatch.projections;

  const projectionsByStop = new Map(
    orderedStops.map((stop, index) => [stop.id, stopProjections[index]!] as const),
  );
  const boardingProjection = projectionsByStop.get(boardingStopId)!;
  const arrivalProjection = projectionsByStop.get(arrivalStopId)!;
  const vehicles = snapshot.vehicles.filter(
    (vehicle) => vehicle.routeId === routeId && vehicle.isOnRoute,
  );
  if (vehicles.length === 0) return unavailable('unavailable', 'no-active-vehicle', route);

  const candidates = vehicles.flatMap((vehicle) => {
    const ageFromRecord = Math.max(0, (now.getTime() - vehicle.recordedAt.getTime()) / 1_000);
    const gpsAgeSeconds = Math.max(vehicle.gpsAgeSeconds, ageFromRecord);
    if (gpsAgeSeconds > staleAfterSeconds) return [];
    const vehicleProjection = projectPointToRoute(vehicle, route.polyline, {
      isLoop: route.isLoop,
      heading: vehicle.bearing,
    });
    if (!vehicleProjection) return [];
    if (
      vehicle.bearing !== undefined &&
      vehicle.groundSpeed !== undefined &&
      vehicle.groundSpeed > 0 &&
      headingDifference(vehicle.bearing, vehicleProjection.segmentBearing) >
        HEADING_MISMATCH_DEGREES
    ) {
      return [];
    }
    const distanceToBoardingMeters = route.isLoop
      ? directedCyclicDistance(
          vehicleProjection.distanceAlongRouteMeters,
          boardingProjection.distanceAlongRouteMeters,
          prepared.length,
        )
      : boardingProjection.distanceAlongRouteMeters - vehicleProjection.distanceAlongRouteMeters;
    if (distanceToBoardingMeters < -STOP_ORDER_TOLERANCE_METERS) return [];
    return [
      {
        vehicle,
        vehicleProjection,
        gpsAgeSeconds: Math.round(gpsAgeSeconds),
        distanceToBoardingMeters: Math.max(0, distanceToBoardingMeters),
        crossesSeam:
          route.isLoop &&
          vehicleProjection.distanceAlongRouteMeters > boardingProjection.distanceAlongRouteMeters,
      },
    ];
  });

  const freshVehicleCount = vehicles.filter((vehicle) => {
    const age = Math.max(
      vehicle.gpsAgeSeconds,
      (now.getTime() - vehicle.recordedAt.getTime()) / 1_000,
    );
    return age <= staleAfterSeconds;
  }).length;
  if (candidates.length === 0) {
    return unavailable(
      freshVehicleCount === 0 ? 'stale' : 'ambiguous',
      freshVehicleCount === 0 ? 'stale-gps' : 'ambiguous-projection',
      route,
    );
  }

  const withoutSeam = candidates.filter((candidate) => !candidate.crossesSeam);
  if (withoutSeam.length === 0) return unavailable('ambiguous', 'seam-crossing', route);
  const next = withoutSeam.sort(
    (left, right) => left.distanceToBoardingMeters - right.distanceToBoardingMeters,
  )[0]!;
  const distanceBoardingToArrivalMeters = route.isLoop
    ? directedCyclicDistance(
        boardingProjection.distanceAlongRouteMeters,
        arrivalProjection.distanceAlongRouteMeters,
        prepared.length,
      )
    : arrivalProjection.distanceAlongRouteMeters - boardingProjection.distanceAlongRouteMeters;
  if (distanceBoardingToArrivalMeters < 0) {
    return unavailable('ambiguous', 'invalid-route-order', route);
  }

  const distanceFromVehicle = (projection: RouteProjection) =>
    route.isLoop
      ? directedCyclicDistance(
          next.vehicleProjection.distanceAlongRouteMeters,
          projection.distanceAlongRouteMeters,
          prepared.length,
        )
      : projection.distanceAlongRouteMeters - next.vehicleProjection.distanceAlongRouteMeters;
  const totalDisplayDistance = next.distanceToBoardingMeters + distanceBoardingToArrivalMeters;
  const displayStops = orderedStops
    .map((stop) => ({ stop, projection: projectionsByStop.get(stop.id)! }))
    .map(({ stop, projection }) => ({ stop, distance: distanceFromVehicle(projection) }))
    .filter(({ distance }) => distance > 1 && distance <= totalDisplayDistance + 1)
    .sort((left, right) => left.distance - right.distance)
    .map(({ stop, distance }) => ({
      stop,
      distanceFromVehicleMeters: distance,
      role:
        stop.id === boardingStopId
          ? ('boarding' as const)
          : stop.id === arrivalStopId
            ? ('arrival' as const)
            : ('intermediate' as const),
    }));
  const stopsAway = displayStops.filter(
    (stop) => stop.distanceFromVehicleMeters <= next.distanceToBoardingMeters + 1,
  ).length;

  return {
    status: 'live',
    route,
    vehicle: next.vehicle,
    boardingStop,
    arrivalStop,
    vehicleProjection: next.vehicleProjection,
    boardingProjection,
    arrivalProjection,
    distanceToBoardingMeters: next.distanceToBoardingMeters,
    distanceBoardingToArrivalMeters,
    stopsAway,
    gpsAgeSeconds: next.gpsAgeSeconds,
    vehicleToBoardingPath: sliceForward(
      route.polyline,
      prepared,
      next.vehicleProjection.distanceAlongRouteMeters,
      boardingProjection.distanceAlongRouteMeters,
    ),
    boardingToArrivalPath: sliceForward(
      route.polyline,
      prepared,
      boardingProjection.distanceAlongRouteMeters,
      arrivalProjection.distanceAlongRouteMeters,
    ),
    passedPath: sliceForward(
      route.polyline,
      prepared,
      0,
      next.vehicleProjection.distanceAlongRouteMeters,
    ),
    displayStops,
  };
}
