import { readFileSync } from 'node:fs';
import { parseGtfsZip } from '../src/core/gtfs/parser';
import { applyDukePublishedSchedules } from '../src/campuses/duke/publishedSchedules';
import published from '../src/campuses/duke/publishedTimetables.json';
import { parseTranslocRoutes, parseTranslocVehicles } from '../src/campuses/duke/transloc';
import { calculateLiveTripProgress, projectPointToRoute } from '../src/core/realtime/routeProgress';

const feed = parseGtfsZip(readFileSync('research/transloc/samples/gtfs-current.zip'));
const routes = parseTranslocRoutes(
  JSON.parse(readFileSync('research/transloc/samples/routes-current.json', 'utf8')),
);
const repaired = applyDukePublishedSchedules(feed);
for (const [index, table] of published.datasets.entries()) {
  const trips = repaired.trips.filter(
    (trip) => trip.serviceId === `duke-published:2026-fall:${index}`,
  );
  if (trips.length !== table.rows.length)
    throw new Error(`Missing published trips: ${table.routeId}`);
  for (const trip of trips) {
    const times = repaired.stopTimes.filter((time) => time.tripId === trip.id);
    for (let i = 1; i < times.length; i++)
      if (times[i]!.arrivalSeconds < times[i - 1]!.departureSeconds)
        throw new Error(`Nonmonotonic ${trip.id}`);
  }
  console.log(
    'SCHEDULE',
    table.routeId,
    table.days.join(','),
    trips.length,
    'published rows verified',
  );
}
const now = new Date();
const vehicles = parseTranslocVehicles(
  JSON.parse(readFileSync('research/transloc/samples/vehicles-current.json', 'utf8')),
  routes,
  now,
);
if (process.argv.includes('--schedules')) {
  console.log('Calendars', feed.calendars);
  for (const route of feed.routes) {
    const trips = feed.trips.filter((t) => t.routeId === route.id);
    console.log(
      route.id,
      route.longName,
      trips.map((t) => ({
        id: t.id,
        service: t.serviceId,
        frequencies: feed.frequencies.filter((f) => f.tripId === t.id),
        first: feed.stopTimes.find((s) => s.tripId === t.id),
      })),
    );
  }
}
for (const route of routes) {
  const statuses: Record<string, number> = {};
  for (const stop of route.stops) {
    const result = calculateLiveTripProgress({
      snapshot: { routes: [route], vehicles, receivedAt: now },
      routeId: route.routeId,
      boardingStopId: stop.id,
      arrivalStopId: route.stops.at(-1)!.id,
      now,
    });
    statuses[result.reason ?? result.status] = (statuses[result.reason ?? result.status] ?? 0) + 1;
  }
  console.log(
    'MAP',
    route.routeId,
    route.name,
    statuses,
    vehicles
      .filter((v) => v.routeId === route.routeId)
      .map((v) => ({
        id: v.vehicleId,
        projection: projectPointToRoute(v, route.polyline, {
          isLoop: route.isLoop,
          heading: v.bearing,
        })?.distanceAlongRouteMeters,
      })),
  );
}
