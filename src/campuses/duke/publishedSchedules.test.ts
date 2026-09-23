import { describe, expect, it } from 'vitest';
import data from './publishedTimetables.json';
import { applyDukePublishedSchedules } from './publishedSchedules';
import type { GtfsFeed } from '../../core/types';
import { isServiceActive } from '../../core/gtfs/service';

function fixture(): GtfsFeed {
  const stopIds = [
    ...new Set(data.datasets.flatMap((table) => table.stops).filter((id): id is string => !!id)),
  ];
  const tables = [...new Map(data.datasets.map((table) => [table.routeId, table])).values()];
  return {
    routes: tables.map((table) => ({
      id: table.routeId,
      shortName: table.routeId,
      longName: 'Test',
      type: 3,
    })),
    stops: stopIds.map((id) => ({ id, name: id, lat: 36, lon: -79 })),
    trips: tables.map((table) => ({
      id: `raw:${table.routeId}`,
      routeId: table.routeId,
      serviceId: 'raw',
    })),
    stopTimes: tables.flatMap((table) =>
      [...new Set(table.stops)]
        .filter((id): id is string => !!id)
        .map((id, index) => ({
          tripId: `raw:${table.routeId}`,
          stopId: id,
          arrivalSeconds: index * 60,
          departureSeconds: index * 60 + 10,
          stopSequence: index + 1,
        })),
    ),
    frequencies: [],
    calendars: [],
    calendarDates: [],
    shapes: [],
  };
}

describe('Duke published Fall 2026 schedules', () => {
  it('replaces relative midnight templates with actual published trips without mutating the raw feed', () => {
    const raw = fixture();
    const before = structuredClone(raw);
    const repaired = applyDukePublishedSchedules(raw);
    expect(raw).toEqual(before);
    expect(repaired.routes).toBe(raw.routes);
    expect(repaired.trips).toHaveLength(
      data.datasets.reduce((count, table) => count + table.rows.length, 0),
    );
    expect(repaired.stopTimes.every((time) => time.arrivalSeconds >= 5 * 3600)).toBe(true);
    expect(applyDukePublishedSchedules(repaired)).toBe(repaired);
  });

  it('retains every mapped official arrival/departure minute, including nonuniform C1 service', () => {
    const repaired = applyDukePublishedSchedules(fixture());
    data.datasets.forEach((table, index) =>
      table.rows.forEach((row, rowIndex) => {
        const times = repaired.stopTimes.filter(
          (time) => time.tripId === `duke-published:2026-fall:${index}:${rowIndex}`,
        );
        table.stops.forEach((stopId, column) => {
          const minute = row[column];
          if (!stopId || minute == null) return;
          expect(
            times.some(
              (time) =>
                time.stopId === stopId &&
                (time.arrivalSeconds === minute * 60 || time.departureSeconds === minute * 60),
            ),
          ).toBe(true);
        });
        for (let i = 1; i < times.length; i++)
          expect(times[i]!.arrivalSeconds).toBeGreaterThanOrEqual(times[i - 1]!.departureSeconds);
      }),
    );
  });

  it('uses weekday/weekend calendars and keeps after-midnight trips on the previous service day', () => {
    const repaired = applyDukePublishedSchedules(fixture());
    const weekdays = 'duke-published:2026-fall:0';
    const weekend = 'duke-published:2026-fall:1';
    expect(isServiceActive(repaired, weekdays, '2026-09-21')).toBe(true);
    expect(isServiceActive(repaired, weekdays, '2026-09-20')).toBe(false);
    expect(isServiceActive(repaired, weekend, '2026-09-20')).toBe(true);
    expect(
      repaired.stopTimes.some(
        (time) =>
          time.tripId.startsWith(weekdays + ':') && time.departureSeconds === 24 * 3600 + 20 * 60,
      ),
    ).toBe(true);
    const h2Weekend = data.datasets.find((d) => d.routeId === 'TL-16' && d.days.includes(0));
    expect(h2Weekend?.rows.at(-1)![0]).toBe(18 * 60 + 30);
  });

  it('does not replace a repaired upstream feed with real absolute-time schedules', () => {
    const raw = fixture();
    raw.stopTimes = raw.stopTimes.map((time) => ({
      ...time,
      arrivalSeconds: time.arrivalSeconds + 7 * 3600,
      departureSeconds: time.departureSeconds + 7 * 3600,
    }));
    expect(applyDukePublishedSchedules(raw)).toBe(raw);
  });

  it('excludes known unscheduled LL templates but retains future frequency-backed repairs', () => {
    const raw = fixture();
    raw.trips.push({ id: 'raw-ll', routeId: 'TL-4', serviceId: 'raw' });
    raw.stopTimes.push(
      { tripId: 'raw-ll', stopId: 'a', arrivalSeconds: 0, departureSeconds: 10, stopSequence: 1 },
      {
        tripId: 'raw-ll',
        stopId: 'b',
        arrivalSeconds: 600,
        departureSeconds: 600,
        stopSequence: 2,
      },
    );
    expect(applyDukePublishedSchedules(raw).trips.some((trip) => trip.id === 'raw-ll')).toBe(false);
    raw.frequencies.push({
      tripId: 'raw-ll',
      startSeconds: 7 * 3600,
      endSeconds: 18 * 3600,
      headwaySeconds: 1200,
      exactTimes: 1,
    });
    expect(applyDukePublishedSchedules(raw).trips.some((trip) => trip.id === 'raw-ll')).toBe(true);
  });
});
