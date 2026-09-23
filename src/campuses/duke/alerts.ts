import { matchAlertText, normalizeAlertText } from '../../core/alerts/match';
import type { AlertMatchCatalog, AlertRouteAlias, AlertStopAlias } from '../../core/alerts/match';
import { parseRssFeed, stripMarkup } from '../../core/alerts/rss';
import { withActiveStatus } from '../../core/alerts/types';
import type { AlertSeverity, TransitAlert } from '../../core/alerts/types';
import type { GtfsFeed } from '../../core/types';
import { dukeRouteFamilies } from './routeFamilies';

export const DUKE_TRANSLOC_ALERTS_URL =
  'https://duke.transloc.com/Services/JSONPRelay.svc/GetTwitterJSON';
export const DUKE_PARKING_RSS_URL = 'https://parking.duke.edu/news/rss.xml';

/** Default lifetime for a Parking news item whose text has no usable event date. */
export const DUKE_ALERT_RSS_TTL_DAYS = 14;
const RSS_TTL_MS = DUKE_ALERT_RSS_TTL_DAYS * 24 * 60 * 60 * 1_000;
/** Upper bound on an extracted event window so old news cannot stay active. */
const RSS_MAX_WINDOW_MS = 45 * 24 * 60 * 60 * 1_000;

const MONTH_INDEX: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

/** Phrases that explicitly mean the whole Duke Transit system is affected. */
export const DUKE_ALERT_SYSTEM_PATTERNS = [
  'all duke transit',
  'all duke buses',
  'all duke bus routes',
  'all duke transit services',
  'all bus routes',
  'all routes',
  'all shuttle routes',
  'all transloc services',
  'campus-wide',
  'system-wide',
];

/** Used before the GTFS feed is available; matching then simply yields `unknown`. */
export const DUKE_EMPTY_ALERT_CATALOG: AlertMatchCatalog = {
  routes: [],
  stops: [],
  systemPatterns: DUKE_ALERT_SYSTEM_PATTERNS,
};

const IMPORTANT_RSS_PHRASES = [
  'detour',
  'reroute',
  're-route',
  'relocat',
  'closed',
  'closure',
  'suspend',
  'cancel',
  'no service',
  'not operate',
  'will not operate',
  'reduced service',
  'limited service',
  'altered schedule',
  'service change',
  'outage',
];

export interface TranslocAlertResponse {
  id?: number | string;
  id_str?: string | null;
  text?: string | null;
  created_at?: string | null;
  end_date?: string | null;
  isAlert?: boolean;
  isRideSystemsMessage?: boolean;
}

const TRANSLOC_DATE =
  /^(\w{3})\s+(\w{3})\s+(\d{1,2})\s+(\d{2}):(\d{2})(?::(\d{2}))?\s+([+-]\d{2}):?(\d{2})\s+(\d{4})$/;

/**
 * Ride Systems emits dates like `Wed Mar 18 13:05:00 -00:00 2026` — seconds and
 * a numeric offset are present here even though the rider map's own format
 * string omits the seconds, so parsing must stay tolerant.
 */
export function parseTranslocDate(value: unknown): Date | undefined {
  if (typeof value !== 'string') return undefined;
  const match = TRANSLOC_DATE.exec(value.trim());
  if (!match) return undefined;
  const [
    ,
    ,
    monthText = '',
    dayText = '',
    hourText = '',
    minuteText = '',
    secondText,
    offsetHoursText = '',
    offsetMinutesText = '',
    yearText = '',
  ] = match;
  const month = MONTH_INDEX[monthText.toLowerCase()];
  if (!month) return undefined;
  // Group 7 carries an explicit sign (e.g. "-04"); positive means ahead of UTC.
  const offsetSign = offsetHoursText.startsWith('-') ? -1 : 1;
  const offsetMinutes =
    offsetSign * (Number(offsetHoursText.slice(1)) * 60 + Number(offsetMinutesText));
  const localMs = Date.UTC(
    Number(yearText),
    month - 1,
    Number(dayText),
    Number(hourText),
    Number(minuteText),
    Number(secondText ?? 0),
  );
  const date = new Date(localMs - offsetMinutes * 60_000);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function compact(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function parseTranslocAlerts(
  raw: unknown,
  catalog: AlertMatchCatalog,
  now: Date,
): TransitAlert[] {
  if (!Array.isArray(raw)) return [];
  const alerts: TransitAlert[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as TranslocAlertResponse;
    const text = typeof item.text === 'string' ? compact(item.text) : '';
    if (!text) continue;
    const idValue = item.id ?? item.id_str;
    if (idValue == null) continue;

    const startsAt = parseTranslocDate(item.created_at);
    const endsAt = parseTranslocDate(item.end_date);
    const match = matchAlertText(text, catalog);

    alerts.push(
      withActiveStatus(
        {
          id: `transloc:${String(idValue)}`,
          source: 'transloc',
          scope: match.scope,
          severity: item.isAlert === true ? 'important' : 'info',
          message: text,
          affectedRouteIds: match.routeIds,
          affectedStopIds: match.stopIds,
          publishedAt: startsAt,
          startsAt,
          endsAt,
          active: false,
          sourceIsAlert: item.isAlert === true,
        },
        now,
      ),
    );
  }
  return alerts;
}

export function classifyRssSeverity(text: string): AlertSeverity {
  const normalized = normalizeAlertText(text);
  return IMPORTANT_RSS_PHRASES.some((phrase) => normalized.includes(phrase)) ? 'important' : 'info';
}

export interface AlertEventWindow {
  startsAt: Date;
  endsAt: Date;
}

function utcDay(month: number, day: number, year: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Best-effort event window from a news item's own text, e.g.
 * "March 13 through March 17" or "June 19-28". Returns `undefined` when no
 * explicit month/day mention can be trusted.
 */
export function extractEventWindow(
  rawText: string,
  publishedAt: Date,
): AlertEventWindow | undefined {
  const publishedMs = publishedAt.getTime();
  const resolveYear = (month: number, day: number, year?: number): number => {
    const candidate = year ?? publishedAt.getUTCFullYear();
    if (Date.UTC(candidate, month - 1, day) < publishedMs - 180 * 24 * 60 * 60 * 1_000) {
      return candidate + 1;
    }
    return candidate;
  };

  const dates: number[] = [];
  const consumed: Array<[number, number]> = [];

  // Compressed same-month ranges such as "June 19-28" or "March 13 to 17".
  for (const match of rawText.matchAll(
    /([a-z]{3,9})\.?\s+(\d{1,2})\s*(?:-|–|—|through|thru|to|until)\s*(\d{1,2})(?!\d)/gi,
  )) {
    const start = match.index ?? 0;
    consumed.push([start, start + match[0].length]);
    const month = MONTH_INDEX[(match[1] ?? '').toLowerCase()];
    if (!month) continue;
    for (const dayText of [match[2], match[3]]) {
      const day = Number(dayText);
      if (!Number.isFinite(day)) continue;
      dates.push(utcDay(month, day, resolveYear(month, day)).getTime());
    }
  }

  // Explicit month/day(/year) mentions, e.g. "Aug. 15" or "July 4, 2026".
  for (const match of rawText.matchAll(
    /([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,\s*(\d{4}))?(?!\d)/gi,
  )) {
    const start = match.index ?? 0;
    if (consumed.some(([from, to]) => start >= from && start < to)) continue;
    const month = MONTH_INDEX[(match[1] ?? '').toLowerCase()];
    if (!month) continue;
    const day = Number(match[2]);
    if (!Number.isFinite(day)) continue;
    dates.push(
      utcDay(
        month,
        day,
        resolveYear(month, day, match[3] ? Number(match[3]) : undefined),
      ).getTime(),
    );
  }

  if (dates.length === 0) return undefined;

  const startMs = Math.min(...dates);
  let endMs = Math.max(...dates) + 24 * 60 * 60 * 1_000 - 1;

  const endOfMonth = /end of ([a-z]{3,9})/i.exec(rawText);
  if (endOfMonth) {
    const month = MONTH_INDEX[(endOfMonth[1] ?? '').toLowerCase()];
    if (month) {
      const onlyDayOfNextMonth = new Date(
        Date.UTC(resolveYear(month, 1), month, 0, 23, 59, 59, 999),
      );
      endMs = Math.max(endMs, onlyDayOfNextMonth.getTime());
    }
  }

  const cap = publishedMs + RSS_MAX_WINDOW_MS;
  if (endMs > cap) endMs = cap;
  if (endMs < startMs) return undefined;
  return { startsAt: new Date(startMs), endsAt: new Date(endMs) };
}

function rssWindow(text: string, publishedAt: Date): AlertEventWindow {
  return (
    extractEventWindow(text, publishedAt) ?? {
      startsAt: publishedAt,
      endsAt: new Date(publishedAt.getTime() + RSS_TTL_MS),
    }
  );
}

export function parseParkingAlerts(
  xml: string,
  catalog: AlertMatchCatalog,
  now: Date,
): TransitAlert[] {
  const alerts: TransitAlert[] = [];
  for (const item of parseRssFeed(xml)) {
    const title = item.title ? stripMarkup(item.title) : undefined;
    const description = item.description ? stripMarkup(item.description) : undefined;
    const message = description || title;
    if (!message) continue;

    const publishedAt = item.pubDate;
    const haystack = compact(`${title ?? ''} ${description ?? ''}`);
    const match = matchAlertText(haystack, catalog);
    const severity = classifyRssSeverity(haystack);
    const window = rssWindow(haystack, publishedAt ?? now);
    const idSource = item.guid ?? item.link ?? `${title ?? ''}|${publishedAt?.toISOString() ?? ''}`;

    alerts.push(
      withActiveStatus(
        {
          id: `parking-rss:${idSource}`,
          source: 'parking-rss',
          scope: match.scope,
          severity,
          title,
          message,
          affectedRouteIds: match.routeIds,
          affectedStopIds: match.stopIds,
          publishedAt,
          startsAt: window.startsAt,
          endsAt: window.endsAt,
          active: false,
          link: item.link,
        },
        now,
      ),
    );
  }
  return alerts;
}

function familyBaseName(name: string): string {
  return name.replace(/\s+(counter-?clockwise|clockwise)$/i, '').trim();
}

/**
 * Builds route/stop aliases from the existing, already-audited data (the GTFS
 * feed and the campus route families). This deliberately adds no second,
 * conflicting ID table: aliases only point at IDs the app already uses.
 */
export function buildDukeAlertCatalog(feed: GtfsFeed): AlertMatchCatalog {
  const routes: AlertRouteAlias[] = [];

  for (const route of feed.routes) {
    const patterns = [route.shortName, route.longName]
      .map((value) => value.trim())
      .filter((value) => value.length > 1);
    if (patterns.length > 0) routes.push({ routeIds: [route.id], patterns });
  }

  const familiesByBaseName = new Map<string, Set<string>>();
  for (const family of dukeRouteFamilies) {
    routes.push({ routeIds: [...family.routeIds], patterns: [family.name] });
    const base = familyBaseName(family.name);
    const ids = familiesByBaseName.get(base) ?? new Set<string>();
    for (const routeId of family.routeIds) ids.add(routeId);
    familiesByBaseName.set(base, ids);
  }
  for (const [base, ids] of familiesByBaseName) {
    routes.push({ routeIds: [...ids], patterns: [base] });
  }

  const stops: AlertStopAlias[] = feed.stops
    .map((stop) => ({
      stopIds: [stop.id],
      patterns: [stop.name, stop.code ?? ''].map((value) => value.trim()).filter(Boolean),
    }))
    .filter((alias) => alias.patterns.length > 0);

  return { routes, stops, systemPatterns: DUKE_ALERT_SYSTEM_PATTERNS };
}

export class DukeTranslocAlertSource {
  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async fetch(
    catalog: AlertMatchCatalog,
    now: Date = new Date(),
    signal?: AbortSignal,
  ): Promise<TransitAlert[]> {
    const response = await this.fetcher(DUKE_TRANSLOC_ALERTS_URL, { cache: 'no-store', signal });
    if (!response.ok) throw new Error(`TransLoc alerts failed with HTTP ${response.status}`);
    return parseTranslocAlerts((await response.json()) as unknown, catalog, now);
  }
}

export class DukeParkingRssSource {
  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async fetch(
    catalog: AlertMatchCatalog,
    now: Date = new Date(),
    signal?: AbortSignal,
  ): Promise<TransitAlert[]> {
    // The feed is served with `cache-control: immutable`, so bypass the cache
    // explicitly; Capacitor's native HTTP bridge handles the missing CORS header.
    const response = await this.fetcher(DUKE_PARKING_RSS_URL, { cache: 'no-store', signal });
    if (!response.ok) throw new Error(`Duke Parking RSS failed with HTTP ${response.status}`);
    return parseParkingAlerts(await response.text(), catalog, now);
  }
}
