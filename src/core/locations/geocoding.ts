import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type { AppLanguage, Location } from '../types';

const DEFAULT_NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const DUKE_VIEWBOX = '-79.10,36.15,-78.75,35.85';
const MINIMUM_REQUEST_INTERVAL_MS = 1_000;

export interface LocationSearchResult extends Location {
  id: string;
  displayName: string;
}

interface NominatimRow {
  place_id?: number | string;
  osm_id?: number | string;
  osm_type?: string;
  lat?: string;
  lon?: string;
  display_name?: string;
}

const sessionCache = new Map<string, LocationSearchResult[]>();
let lastRequestStartedAt = 0;

export function parseNominatimResults(value: unknown): LocationSearchResult[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((candidate, index) => {
    if (!candidate || typeof candidate !== 'object') return [];
    const row = candidate as NominatimRow;
    const lat = Number(row.lat);
    const lon = Number(row.lon);
    const displayName = row.display_name?.trim();
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !displayName) return [];

    const sourceId = row.osm_id ?? row.place_id ?? index;
    return [
      {
        id: `${row.osm_type ?? 'place'}-${sourceId}`,
        lat,
        lon,
        label: displayName,
        displayName,
      },
    ];
  });
}

export function buildLocationSearchUrl(query: string, language: AppLanguage = 'en'): string {
  const configuredUrl = import.meta.env.VITE_NOMINATIM_URL?.trim();
  const url = new URL(configuredUrl || DEFAULT_NOMINATIM_URL);
  url.searchParams.set('q', query.trim());
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '5');
  url.searchParams.set('countrycodes', 'us');
  url.searchParams.set('viewbox', DUKE_VIEWBOX);
  url.searchParams.set('bounded', '0');
  url.searchParams.set('accept-language', language === 'zh-CN' ? 'zh-CN,en' : 'en-US,en');
  return url.toString();
}

async function waitForRateLimit(): Promise<void> {
  const remaining = MINIMUM_REQUEST_INTERVAL_MS - (Date.now() - lastRequestStartedAt);
  if (remaining > 0) await new Promise((resolve) => setTimeout(resolve, remaining));
  lastRequestStartedAt = Date.now();
}

async function requestJson(
  url: string,
  language: AppLanguage,
  signal?: AbortSignal,
): Promise<unknown> {
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.get({
      url,
      headers: {
        Accept: 'application/json',
        'Accept-Language': language === 'zh-CN' ? 'zh-CN,en' : 'en-US,en',
        'User-Agent': 'CampusCommuteAssistant/0.1 (Duke campus commute app)',
      },
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Address search returned HTTP ${response.status}.`);
    }
    return response.data;
  }

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw new Error(`Address search returned HTTP ${response.status}.`);
  return response.json() as Promise<unknown>;
}

export async function searchLocations(
  query: string,
  signal?: AbortSignal,
  language: AppLanguage = 'en',
): Promise<LocationSearchResult[]> {
  const normalizedQuery = query.trim().replace(/\s+/g, ' ');
  if (normalizedQuery.length < 3) throw new Error('Enter at least 3 characters.');

  const cacheKey = normalizedQuery.toLocaleLowerCase();
  const cached = sessionCache.get(cacheKey);
  if (cached) return cached;

  await waitForRateLimit();
  if (signal?.aborted) throw new DOMException('The request was aborted.', 'AbortError');

  const results = parseNominatimResults(
    await requestJson(buildLocationSearchUrl(normalizedQuery, language), language, signal),
  );
  sessionCache.set(cacheKey, results);
  return results;
}
