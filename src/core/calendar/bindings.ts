import { findBuilding, normalizeLocation } from '../locations/geo';
import type { CampusBuilding, ClassEvent } from '../types';

const canonical = (value: string) =>
  value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');

export function classBindingKey(event: Pick<ClassEvent, 'title' | 'location'>): string {
  return `${canonical(event.title)}::${canonical(event.location)}`;
}

export function buildingBindingKey(
  event: Pick<ClassEvent, 'title' | 'location'>,
  buildings: CampusBuilding[],
): string {
  const knownBuilding = findBuilding(event.location, buildings);
  if (knownBuilding) return `building:${knownBuilding.id}`;

  const normalizedLocation = normalizeLocation(event.location);
  return normalizedLocation
    ? `building-name:${normalizedLocation}`
    : `exact:${classBindingKey(event)}`;
}
