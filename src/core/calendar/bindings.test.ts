import { describe, expect, it } from 'vitest';
import type { CampusBuilding } from '../types';
import { buildingBindingKey, classBindingKey } from './bindings';

const buildings: CampusBuilding[] = [
  {
    id: 'ciemas',
    name: 'CIEMAS',
    aliases: ['Fitzpatrick Center'],
    lat: 36,
    lon: -78,
  },
];

describe('class stop binding keys', () => {
  it('is stable across recurring occurrences with the same course and room', () => {
    expect(classBindingKey({ title: 'ME 555', location: 'Wilkinson 129' })).toBe(
      classBindingKey({ title: '  me 555 ', location: 'WILKINSON   129' }),
    );
  });

  it('keeps different rooms separate', () => {
    expect(classBindingKey({ title: 'ME 555', location: 'Wilkinson 129' })).not.toBe(
      classBindingKey({ title: 'ME 555', location: 'Hudson 125' }),
    );
  });

  it('can share one experimental binding across rooms in an uncatalogued building', () => {
    expect(buildingBindingKey({ title: 'ME 555', location: 'Wilkinson 216' }, buildings)).toBe(
      buildingBindingKey({ title: 'ECE 590', location: 'Wilkinson Room 123' }, buildings),
    );
  });

  it('uses a stable catalog id across building aliases', () => {
    expect(buildingBindingKey({ title: 'ME 555', location: 'CIEMAS 2240' }, buildings)).toBe(
      buildingBindingKey({ title: 'ECE 590', location: 'Fitzpatrick Center 123' }, buildings),
    );
  });

  it('does not merge different buildings in experimental mode', () => {
    expect(buildingBindingKey({ title: 'ME 555', location: 'Wilkinson 216' }, buildings)).not.toBe(
      buildingBindingKey({ title: 'ME 555', location: 'Hudson 216' }, buildings),
    );
  });

  it('falls back to an exact key when no location exists', () => {
    expect(buildingBindingKey({ title: 'ME 555', location: '' }, buildings)).not.toBe(
      buildingBindingKey({ title: 'ECE 590', location: '' }, buildings),
    );
  });
});
