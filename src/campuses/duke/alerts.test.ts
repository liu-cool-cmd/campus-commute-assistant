import { describe, expect, it, vi } from 'vitest';
import type { GtfsFeed } from '../../core/types';
import {
  buildDukeAlertCatalog,
  classifyRssSeverity,
  DUKE_ALERT_RSS_TTL_DAYS,
  DUKE_PARKING_RSS_URL,
  DUKE_TRANSLOC_ALERTS_URL,
  DukeParkingRssSource,
  DukeTranslocAlertSource,
  extractEventWindow,
  parseParkingAlerts,
  parseTranslocAlerts,
  parseTranslocDate,
} from './alerts';

const feed: GtfsFeed = {
  stops: [{ id: 'TL-200', name: 'Abele Quad', code: 'ABELE', lat: 36, lon: -78.9 }],
  routes: [
    { id: 'TL-4', shortName: 'C1', longName: 'C1: East-West', type: 3 },
    { id: 'TL-13', shortName: 'LLN', longName: 'LaSalle Loop Counterclockwise', type: 3 },
    { id: 'TL-16', shortName: 'LNC', longName: 'Lancaster Commons', type: 3 },
  ],
  trips: [],
  stopTimes: [],
  frequencies: [],
  calendars: [],
  calendarDates: [],
  shapes: [],
};

const catalog = buildDukeAlertCatalog(feed);
const now = new Date('2026-09-23T12:00:00Z');

/** Real non-empty payload captured from a Ride Systems live tracker. */
const translocPayload = [
  {
    created_at: 'Wed Mar 18 13:05:00 -00:00 2026',
    end_date: 'Thu Mar 18 20:00:00 -00:00 2027',
    favorited: false,
    id: 87,
    id_str: null,
    isAlert: true,
    isRideSystemsMessage: true,
    lang: null,
    retweeted: false,
    source: null,
    text: 'UC Parking & Transportation is excited to announce a change.\u000aFirst Time Rider',
    truncated: false,
  },
];

const parkingRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<title><![CDATA[News RSS Feed]]></title>
<item>
  <title><![CDATA[West Campus Portion of Chapel Drive to Reopen Monday]]></title>
  <description><![CDATA[C1 East-West and C-Swift Shuttle bus routes will resume use of Abele Quad stop]]></description>
  <link>https://today.duke.edu/2022/08/west-campus-portion-chapel-drive-reopen-monday</link>
  <guid isPermaLink="false">7977674f-4591-4f94-9d2a-2b8ba83b1445</guid>
  <pubDate>Fri, 05 Aug 2022 00:00:00 GMT</pubDate>
  <category>HR|Parking and Transportation|Staff</category>
</item>
<item>
  <title><![CDATA[Section of Campus Drive to Close for Bridge Repairs]]></title>
  <description><![CDATA[A detour will help buses and motorists access East Campus March 13 through March 17]]></description>
  <link>https://today.duke.edu/2023/03/section-campus-drive-close-bridge-repairs</link>
  <guid isPermaLink="false">5a0b4c9e-86a0-422b-b8c2-2decf2736e55</guid>
  <pubDate>Thu, 09 Mar 2023 00:00:00 GMT</pubDate>
  <category>HR|Parking and Transportation|Staff</category>
</item>
<item>
  <title><![CDATA[Duke Parking Permit Rates Adjust for 2026-27]]></title>
  <description><![CDATA[In addition to monthly permits, daily and multi-day permits are available]]></description>
  <link>https://today.duke.edu/2026/07/duke-parking-permit-rates-adjust-2026-27</link>
  <guid isPermaLink="false">9f651f01-3786-42ce-b365-9d14df684c58</guid>
  <pubDate>Mon, 13 Jul 2026 00:00:00 GMT</pubDate>
  <category>HR|Parking and Transportation|Staff</category>
</item>
</channel></rss>`;

describe('Duke TransLoc alert parsing', () => {
  it('parses the Rider Systems date format, including seconds and an offset', () => {
    expect(parseTranslocDate('Wed Mar 18 13:05:00 -00:00 2026')?.toISOString()).toBe(
      '2026-03-18T13:05:00.000Z',
    );
    expect(parseTranslocDate('Fri Mar 13 09:00:00 -04:00 2026')?.toISOString()).toBe(
      '2026-03-13T13:00:00.000Z',
    );
    expect(parseTranslocDate('nonsense')).toBeUndefined();
  });

  it('maps a real payload onto a TransitAlert', () => {
    const alerts = parseTranslocAlerts(translocPayload, catalog, now);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({
      id: 'transloc:87',
      source: 'transloc',
      severity: 'important',
      scope: 'unknown',
      affectedRouteIds: [],
      sourceIsAlert: true,
      active: true,
    });
    expect(alerts[0]!.startsAt?.toISOString()).toBe('2026-03-18T13:05:00.000Z');
    expect(alerts[0]!.endsAt?.toISOString()).toBe('2027-03-18T20:00:00.000Z');
  });

  it('classifies a non-alert message as informational', () => {
    const alerts = parseTranslocAlerts(
      [
        {
          id: 5,
          text: 'Schedules are unchanged this week.',
          isAlert: false,
          created_at: null,
          end_date: null,
        },
      ],
      catalog,
      now,
    );
    expect(alerts[0]).toMatchObject({ severity: 'info', endsAt: undefined, active: true });
  });

  it('matches routes and stops from the message text', () => {
    const alerts = parseTranslocAlerts(
      [{ id: 9, text: 'C1 detour near Abele Quad stop.', isAlert: true, end_date: null }],
      catalog,
      now,
    );
    expect(alerts[0]!.affectedRouteIds).toEqual(['TL-4']);
    expect(alerts[0]!.affectedStopIds).toEqual(['TL-200']);
    expect(alerts[0]!.scope).toBe('routes');
  });

  it('ignores an empty or malformed feed', () => {
    expect(parseTranslocAlerts([], catalog, now)).toEqual([]);
    expect(parseTranslocAlerts(null, catalog, now)).toEqual([]);
    expect(parseTranslocAlerts([{ id: 1, text: '' }], catalog, now)).toEqual([]);
  });
});

describe('Duke Parking RSS alert parsing', () => {
  it('turns news items into alerts with stable ids, links and a lifecycle', () => {
    const alerts = parseParkingAlerts(parkingRss, catalog, now);
    expect(alerts).toHaveLength(3);

    const stopChange = alerts[0]!;
    expect(stopChange).toMatchObject({
      id: 'parking-rss:7977674f-4591-4f94-9d2a-2b8ba83b1445',
      source: 'parking-rss',
      scope: 'routes',
      severity: 'info',
      affectedStopIds: ['TL-200'],
      active: false,
      link: 'https://today.duke.edu/2022/08/west-campus-portion-chapel-drive-reopen-monday',
    });
    expect(stopChange.affectedRouteIds).toContain('TL-4');
    expect(stopChange.publishedAt?.toISOString()).toBe('2022-08-05T00:00:00.000Z');
  });

  it('classifies a detour as important and uses an explicit date range', () => {
    const detour = parseParkingAlerts(parkingRss, catalog, now)[1]!;
    expect(detour.severity).toBe('important');
    expect(detour.scope).toBe('unknown');
    expect(detour.startsAt?.toISOString()).toBe('2023-03-13T00:00:00.000Z');
    expect(detour.endsAt?.toISOString()).toBe('2023-03-17T23:59:59.999Z');
  });

  it('falls back to a 14-day TTL when no event date is present', () => {
    const permit = parseParkingAlerts(parkingRss, catalog, now)[2]!;
    expect(permit.severity).toBe('info');
    expect(permit.startsAt?.toISOString()).toBe('2026-07-13T00:00:00.000Z');
    expect(permit.endsAt?.toISOString()).toBe('2026-07-27T00:00:00.000Z');
    expect(DUKE_ALERT_RSS_TTL_DAYS).toBe(14);
  });

  it('keeps a recent item active and lets old news expire', () => {
    const fresh = parseParkingAlerts(parkingRss, catalog, new Date('2026-07-15T12:00:00Z'));
    expect(fresh[2]!.active).toBe(true);
    expect(fresh[0]!.active).toBe(false);
  });
});

describe('extractEventWindow', () => {
  it('handles compressed same-month day ranges', () => {
    const window = extractEventWindow(
      'Chapel Drive closed June 19-28',
      new Date('2024-06-05T00:00:00Z'),
    );
    expect(window?.startsAt.toISOString()).toBe('2024-06-19T00:00:00.000Z');
    expect(window?.endsAt.toISOString()).toBe('2024-06-28T23:59:59.999Z');
  });

  it('returns undefined without an explicit month and day', () => {
    expect(
      extractEventWindow('starting in April', new Date('2024-04-12T00:00:00Z')),
    ).toBeUndefined();
  });

  it('caps an implausibly long window so old news cannot stay active', () => {
    const published = new Date('2024-07-01T00:00:00Z');
    const window = extractEventWindow('from April 1 through August 31', published);
    expect(window?.endsAt.toISOString()).toBe(
      new Date(published.getTime() + 45 * 24 * 60 * 60 * 1_000).toISOString(),
    );
  });
});

describe('classifyRssSeverity', () => {
  it('marks disruptions important and routine news informational', () => {
    expect(classifyRssSeverity('A detour will help buses access East Campus')).toBe('important');
    expect(classifyRssSeverity('Duke Transit services will not operate on Monday')).toBe(
      'important',
    );
    expect(classifyRssSeverity('TransLoc Bus Tracking System Experiencing National Outage')).toBe(
      'important',
    );
    expect(classifyRssSeverity('Duke Parking Permit Rates Adjust for 2026-27')).toBe('info');
  });
});

describe('Duke alert sources', () => {
  it('fetches and parses the TransLoc feed without caching', async () => {
    const fetcher = vi.fn(async () => Response.json(translocPayload));
    const source = new DukeTranslocAlertSource(fetcher as unknown as typeof fetch);
    const alerts = await source.fetch(catalog, now);
    expect(fetcher).toHaveBeenCalledWith(DUKE_TRANSLOC_ALERTS_URL, {
      cache: 'no-store',
      signal: undefined,
    });
    expect(alerts).toHaveLength(1);
  });

  it('fetches and parses the Parking RSS feed', async () => {
    const fetcher = vi.fn(async () => new Response(parkingRss, { status: 200 }));
    const source = new DukeParkingRssSource(fetcher as unknown as typeof fetch);
    const alerts = await source.fetch(catalog, now);
    expect(fetcher).toHaveBeenCalledWith(DUKE_PARKING_RSS_URL, {
      cache: 'no-store',
      signal: undefined,
    });
    expect(alerts).toHaveLength(3);
  });

  it('surfaces a non-OK response as an error', async () => {
    const source = new DukeTranslocAlertSource(
      (async () => new Response('', { status: 503 })) as unknown as typeof fetch,
    );
    await expect(source.fetch(catalog, now)).rejects.toThrow('503');
  });
});
