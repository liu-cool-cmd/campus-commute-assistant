import type { GtfsFeed, ServiceCalendar, StopTime, Trip } from '../../core/types';
import data from './publishedTimetables.json';
import { canonicalRouteTemplates } from './canonicalRouteTemplates';

const PREFIX = 'duke-published:2026-fall:';

function getCanonicalTemplate(routeId: string): StopTime[] | undefined {
  const stops = canonicalRouteTemplates[routeId];
  if (!stops) return undefined;
  return stops.map((s, index) => ({
    tripId: `canonical:${routeId}`,
    stopId: s.stopId,
    arrivalSeconds: s.secondsFromStart,
    departureSeconds: s.secondsFromStart,
    stopSequence: index + 1,
  }));
}

/** Apply the audited Fall 2026 tables to the known relative-time TransLoc export.
 * The downloaded archive is untouched. All original route/stop IDs remain exact.
 * A future real scheduled export (absolute stop times) takes precedence.
 */
export function applyDukePublishedSchedules(feed: GtfsFeed): GtfsFeed {
  const timesByTrip = new Map<string, StopTime[]>();
  for (const time of feed.stopTimes) {
    const times = timesByTrip.get(time.tripId) ?? [];
    times.push(time);
    timesByTrip.set(time.tripId, times);
  }
  for (const times of timesByTrip.values()) times.sort((a, b) => a.stopSequence - b.stopSequence);
  const covered = new Set([
    ...data.datasets.map((table) => table.routeId),
    'TL-10',
  ]);
  const replaced = new Set<string>();
  const templates = new Map<string, StopTime[]>();
  for (const routeId of covered) {
    const trips = feed.trips.filter((trip) => trip.routeId === routeId);
    if (!trips.length || trips.some((trip) => trip.scheduleSource)) continue;
    // These routes have no matching published replacement or keep future frequency-backed repairs intact.
    if (
      ['TL-4', 'TL-17', 'TL-10'].includes(routeId) &&
      trips.some((trip) => feed.frequencies.some((f) => f.tripId === trip.id))
    )
      continue;
    // This repair applies only to the observed relative templates, never arbitrary scheduled feeds.
    if (
      !trips.every((trip) => {
        const times = timesByTrip.get(trip.id) ?? [];
        return (
          times.length > 1 && times[0]!.arrivalSeconds === 0 && times.at(-1)!.arrivalSeconds < 3600
        );
      })
    )
      continue;
    for (const trip of trips) replaced.add(trip.id);
    templates.set(routeId, timesByTrip.get(trips[0]!.id)!);
  }
  if (!replaced.size) return feed;
  const trips: Trip[] = feed.trips.filter((trip) => !replaced.has(trip.id));
  const stopTimes = feed.stopTimes.filter((time) => !replaced.has(time.tripId));
  const calendars = [...feed.calendars];
  const stopIds = new Set(feed.stops.map((stop) => stop.id));
  data.datasets.forEach((table, tableIndex) => {
    const template = templates.get(table.routeId) ?? getCanonicalTemplate(table.routeId);
    if (!template) return;
    const serviceId = `${PREFIX}${tableIndex}`;
    calendars.push({
      serviceId,
      startDate: data.startDate,
      endDate: data.endDate,
      weekdays: Array.from({ length: 7 }, (_, day) =>
        table.days.includes(day),
      ) as ServiceCalendar['weekdays'],
    });
    table.rows.forEach((row, rowIndex) => {
      const tripId = `${serviceId}:${rowIndex}`;
      const times: StopTime[] = [];
      let previousColumn = -1;
      for (let column = 0; column < table.stops.length; column++) {
        const stopId = table.stops[column];
        const minutes = row[column];
        if (!stopId || !stopIds.has(stopId) || minutes == null) {
          previousColumn = -1;
          continue;
        }
        const previous = times.at(-1);
        if (previous && previous.stopId === stopId && previousColumn === column - 1) {
          previous.departureSeconds = minutes * 60;
          previousColumn = column;
          continue;
        }
        // Intermediate stops are estimates between published anchors. Never interpolate across
        // a blank/skipped/unmapped timing point or the LNC topology conflict.
        if (
          previous &&
          previousColumn === column - 1 &&
          !['TL-9', 'TL-16'].includes(table.routeId)
        ) {
          const start = template.findIndex((time) => time.stopId === previous.stopId);
          let end = template.findIndex((time, index) => index > start && time.stopId === stopId);
          if (end < 0 && start >= 0) {
            const wrappedEnd = template.findIndex((time) => time.stopId === stopId);
            if (wrappedEnd >= 0) end = wrappedEnd + template.length;
          }
          if (start >= 0 && end > start && end < start + template.length) {
            const cycle = template.at(-1)!.departureSeconds;
            const startSeconds = template[start]!.departureSeconds;
            const endSeconds =
              template[end % template.length]!.arrivalSeconds +
              (end >= template.length ? cycle : 0);
            if (endSeconds > startSeconds)
              for (let index = start + 1; index < end; index++) {
                const item = template[index % template.length]!;
                if (item.stopId === previous.stopId || item.stopId === stopId) continue;
                const ratio =
                  (item.arrivalSeconds + (index >= template.length ? cycle : 0) - startSeconds) /
                  (endSeconds - startSeconds);
                const seconds = Math.round(
                  previous.departureSeconds + ratio * (minutes * 60 - previous.departureSeconds),
                );
                times.push({
                  tripId,
                  stopId: item.stopId,
                  arrivalSeconds: seconds,
                  departureSeconds: seconds,
                  stopSequence: times.length + 1,
                  timingSource: 'interpolated',
                });
              }
          }
        }
        times.push({
          tripId,
          stopId,
          arrivalSeconds: minutes * 60,
          departureSeconds: minutes * 60,
          stopSequence: times.length + 1,
          timingSource: 'published',
        });
        previousColumn = column;
      }
      if (times.length < 2) return;
      trips.push({
        id: tripId,
        routeId: table.routeId,
        serviceId,
        scheduleSource: {
          kind: 'official-supplement',
          label: 'Duke official Fall 2026 timetable',
          url: table.source,
          verifiedOn: data.verifiedOn,
          includesEstimatedStopTimes: times.some((time) => time.timingSource === 'interpolated'),
        },
      });
      stopTimes.push(...times);
    });
  });
  return {
    ...feed,
    trips,
    stopTimes,
    calendars,
    frequencies: feed.frequencies.filter((frequency) => !replaced.has(frequency.tripId)),
  };
}
