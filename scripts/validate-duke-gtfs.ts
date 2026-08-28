import { dukeCampus } from '../src/campuses/duke/config';
import { supplementDukeOfficialSchedules } from '../src/campuses/duke/officialSchedule';
import { getTripInstances } from '../src/core/gtfs/frequencies';
import { parseGtfsZip } from '../src/core/gtfs/parser';
import type { TransitRoute } from '../src/core/types';

const response = await fetch(dukeCampus.config.gtfsUrl);
if (!response.ok) throw new Error(`Duke GTFS returned HTTP ${response.status}`);

const feed = parseGtfsZip(await response.arrayBuffer());
const supplementedFeed = supplementDukeOfficialSchedules(feed);
const counts = {
  stops: feed.stops.length,
  routes: feed.routes.length,
  trips: feed.trips.length,
  stopTimes: feed.stopTimes.length,
  frequencies: feed.frequencies.length,
  calendars: feed.calendars.length,
  calendarDates: feed.calendarDates.length,
  shapes: feed.shapes.length,
};

if (counts.stops === 0 || counts.routes === 0 || counts.trips === 0 || counts.stopTimes === 0) {
  throw new Error(`Duke GTFS is structurally empty: ${JSON.stringify(counts)}`);
}

const secondsToGtfsTime = (totalSeconds: number) => {
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
};

const routeAudit = (route: TransitRoute) => {
  const trips = feed.trips.filter((trip) => trip.routeId === route.id);
  return {
    routeId: route.id,
    shortName: route.shortName,
    longName: route.longName,
    trips: trips.map((trip) => {
      const stopTimes = feed.stopTimes
        .filter((stopTime) => stopTime.tripId === trip.id)
        .sort((a, b) => a.stopSequence - b.stopSequence);
      const frequencies = feed.frequencies.filter((entry) => entry.tripId === trip.id);
      const instances = getTripInstances(stopTimes, frequencies);
      return {
        tripId: trip.id,
        serviceId: trip.serviceId,
        frequencyWindows: frequencies.map((entry) => ({
          start: secondsToGtfsTime(entry.startSeconds),
          end: secondsToGtfsTime(entry.endSeconds),
          headwaySeconds: entry.headwaySeconds,
          exactTimes: entry.exactTimes,
        })),
        sampleFirstStopDepartures: instances
          .slice(0, 3)
          .map((instance) =>
            secondsToGtfsTime((stopTimes[0]?.departureSeconds ?? 0) + instance.timeOffsetSeconds),
          ),
      };
    }),
  };
};

const c1Routes = feed.routes.filter((route) => route.longName.startsWith('C1:'));
const llRoutes = feed.routes.filter((route) => /^LL(?:CCWN|CCW|N)?:/.test(route.longName));
const c1Audit = c1Routes.map((route) => routeAudit(route));
const llAudit = llRoutes.map((route) => routeAudit(route));
const officialSupplementTrips = supplementedFeed.trips.filter(
  (trip) => trip.scheduleSource?.kind === 'official-supplement',
);
const officialDayTrip = officialSupplementTrips.find((trip) => trip.routeId === 'TL-13');
const officialDayStopTimes = supplementedFeed.stopTimes
  .filter((stopTime) => stopTime.tripId === officialDayTrip?.id)
  .sort((a, b) => a.stopSequence - b.stopSequence);
const officialDayInstances = getTripInstances(
  officialDayStopTimes,
  supplementedFeed.frequencies.filter((entry) => entry.tripId === officialDayTrip?.id),
);

if (
  c1Audit.length === 0 ||
  c1Audit.every((route) => route.trips.every((trip) => trip.frequencyWindows.length === 0))
) {
  throw new Error('Raw Duke GTFS did not contain a frequency-backed C1 route.');
}
if (llRoutes.some((route) => route.id === 'TL-13') && !officialDayTrip) {
  throw new Error('LLCCW has no raw trips and the official Duke timetable supplement failed.');
}
if (officialDayTrip && officialDayStopTimes.length !== 18) {
  throw new Error(`Official Duke LLCCW supplement has ${officialDayStopTimes.length}/18 stops.`);
}
if (
  officialDayTrip &&
  (officialDayInstances[0]?.timeOffsetSeconds !== 7 * 3_600 + 12 * 60 ||
    officialDayInstances.at(-1)?.timeOffsetSeconds !== 17 * 3_600 + 36 * 60)
) {
  throw new Error('Official Duke LLCCW daytime departures do not match 07:12–17:36.');
}

console.log(
  JSON.stringify(
    {
      source: dukeCampus.config.gtfsUrl,
      counts,
      rawCalendars: feed.calendars,
      rawRouteAudit: {
        c1: c1Audit,
        llVariants: llAudit,
      },
      officialScheduleSupplement: {
        source: officialDayTrip?.scheduleSource,
        trips: officialSupplementTrips.map((trip) => ({
          routeId: trip.routeId,
          tripId: trip.id,
        })),
        llccwFirstDeparture: officialDayInstances[0]
          ? secondsToGtfsTime(officialDayInstances[0].timeOffsetSeconds)
          : undefined,
        llccwLastDeparture: officialDayInstances.at(-1)
          ? secondsToGtfsTime(officialDayInstances.at(-1)!.timeOffsetSeconds)
          : undefined,
        llccwStops: officialDayStopTimes.map((stopTime) => ({
          stopId: stopTime.stopId,
          stopName: supplementedFeed.stops.find((stop) => stop.id === stopTime.stopId)?.name,
          timingSource: stopTime.timingSource,
        })),
      },
    },
    null,
    2,
  ),
);
