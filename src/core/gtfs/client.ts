import type { GtfsFeed } from '../types';
import { readCachedGtfs, writeCachedGtfs } from './cache';
import { parseGtfsZip } from './parser';

export interface GtfsSnapshot {
  feed: GtfsFeed;
  fetchedAt: Date;
  source: 'cache' | 'network';
}

interface LoadOptions {
  campusId: string;
  url: string;
  refreshHours: number;
  forceRefresh?: boolean;
}

export async function loadGtfs({
  campusId,
  url,
  refreshHours,
  forceRefresh = false,
}: LoadOptions): Promise<GtfsSnapshot> {
  const cached = await readCachedGtfs(campusId);
  const cacheAge = cached
    ? Date.now() - new Date(cached.fetchedAt).getTime()
    : Number.POSITIVE_INFINITY;
  if (cached && !forceRefresh && cacheAge < refreshHours * 3_600_000) {
    return {
      feed: parseGtfsZip(cached.data),
      fetchedAt: new Date(cached.fetchedAt),
      source: 'cache',
    };
  }

  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`GTFS download failed with HTTP ${response.status}`);
    const data = await response.arrayBuffer();
    const feed = parseGtfsZip(data);
    const fetchedAt = new Date();
    await writeCachedGtfs({ campusId, sourceUrl: url, fetchedAt: fetchedAt.toISOString(), data });
    return { feed, fetchedAt, source: 'network' };
  } catch (error) {
    if (cached) {
      return {
        feed: parseGtfsZip(cached.data),
        fetchedAt: new Date(cached.fetchedAt),
        source: 'cache',
      };
    }
    throw error;
  }
}
