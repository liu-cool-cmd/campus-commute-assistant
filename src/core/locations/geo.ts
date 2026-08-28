import type { CampusBuilding, Coordinates } from '../types';

const EARTH_RADIUS_METERS = 6_371_000;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const latitudeDelta = toRadians(b.lat - a.lat);
  const longitudeDelta = toRadians(b.lon - a.lon);
  const latitude1 = toRadians(a.lat);
  const latitude2 = toRadians(b.lat);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
}

export function estimateWalkingMinutes(
  origin: Coordinates,
  destination: Coordinates,
  speedMetersPerSecond = 1.3,
  correctionFactor = 1.25,
): number {
  if (speedMetersPerSecond <= 0 || correctionFactor < 1) {
    throw new Error('Walking speed must be positive and correction factor must be at least 1.');
  }
  return Math.ceil(
    (distanceMeters(origin, destination) * correctionFactor) / speedMetersPerSecond / 60,
  );
}

export function normalizeLocation(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[–—-]/g, ' ')
    .replace(/\b(?:room|rm|suite)\s*[a-z]?\d+[a-z-]*\b/gi, ' ')
    .replace(/\b[a-z]?\d{2,4}[a-z-]*\b/gi, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase();
}

export function findBuilding(
  input: string,
  buildings: CampusBuilding[],
): CampusBuilding | undefined {
  const normalized = normalizeLocation(input);
  if (!normalized) return undefined;

  return buildings.find((building) =>
    [building.name, ...building.aliases].some((alias) => {
      const normalizedAlias = normalizeLocation(alias);
      return normalized === normalizedAlias || normalized.startsWith(`${normalizedAlias} `);
    }),
  );
}
