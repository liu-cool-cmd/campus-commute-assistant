import type { CampusBuilding } from '../../core/types';

// A deliberately small seed catalog. Coordinates are building entrances/centroids from public maps.
export const dukeBuildings: CampusBuilding[] = [
  {
    id: 'ciemas',
    name: 'CIEMAS',
    aliases: ['Fitzpatrick Center', 'FCIEMAS', 'Fitzpatrick CIEMAS'],
    lat: 36.00321,
    lon: -78.94038,
  },
  {
    id: 'hudson-hall',
    name: 'Hudson Hall',
    aliases: ['Hudson', 'Hudson Engineering'],
    lat: 36.0042,
    lon: -78.9405,
  },
  {
    id: 'gross-hall',
    name: 'Gross Hall',
    aliases: ['Gross', 'Gross Hall for Interdisciplinary Innovation'],
    lat: 36.0012,
    lon: -78.9447,
  },
  {
    id: 'lsrc',
    name: 'Levine Science Research Center',
    aliases: ['LSRC', 'Levine Science Research Center'],
    lat: 36.00449,
    lon: -78.94204,
  },
  {
    id: 'physics',
    name: 'Physics Building',
    aliases: ['Physics', 'Duke Physics'],
    lat: 36.00448,
    lon: -78.94329,
  },
  {
    id: 'ffsc',
    name: 'French Family Science Center',
    aliases: ['FFSC', 'French Family', 'French Science'],
    lat: 36.00405,
    lon: -78.94386,
  },
];
