import { describe, expect, it } from 'vitest';
import { buildLocationSearchUrl, parseNominatimResults } from './geocoding';

describe('location geocoding', () => {
  it('builds a Duke-biased, user-submitted US search', () => {
    const url = new URL(buildLocationSearchUrl('  300 Swift Ave  '));

    expect(url.origin).toBe('https://nominatim.openstreetmap.org');
    expect(url.searchParams.get('q')).toBe('300 Swift Ave');
    expect(url.searchParams.get('countrycodes')).toBe('us');
    expect(url.searchParams.get('viewbox')).toBe('-79.10,36.15,-78.75,35.85');
    expect(url.searchParams.get('limit')).toBe('5');
    expect(url.searchParams.get('accept-language')).toBe('en-US,en');
  });

  it('requests localized search results', () => {
    const url = new URL(buildLocationSearchUrl('Duke University', 'zh-CN'));
    expect(url.searchParams.get('accept-language')).toBe('zh-CN,en');
  });

  it('keeps only usable coordinates and labels', () => {
    expect(
      parseNominatimResults([
        {
          place_id: 12,
          osm_type: 'way',
          osm_id: 34,
          lat: '36.0042',
          lon: '-78.9411',
          display_name: '300 Swift Avenue, Durham, North Carolina',
        },
        { place_id: 13, lat: 'not-a-number', lon: '-78.9', display_name: 'Broken' },
        { place_id: 14, lat: '36', lon: '-78.9' },
      ]),
    ).toEqual([
      {
        id: 'way-34',
        lat: 36.0042,
        lon: -78.9411,
        label: '300 Swift Avenue, Durham, North Carolina',
        displayName: '300 Swift Avenue, Durham, North Carolina',
      },
    ]);
  });
});
