import type { GtfsFeed, StopTime, TransitSelectionDraft, Trip } from '../../core/types';

export const DUKE_LLCCW_SCHEDULE_URL =
  'https://parking.duke.edu/buses-vans/ll-lasalle-loop-counter-clockwise/';

export const DUKE_OFFICIAL_SCHEDULE_PREFIX = 'duke-official:';

const SERVICE_ID = `${DUKE_OFFICIAL_SCHEDULE_PREFIX}llccw:2026-2027:weekday`;
const SOURCE = {
  kind: 'official-supplement' as const,
  label: 'Duke official timetable',
  url: DUKE_LLCCW_SCHEDULE_URL,
  verifiedOn: '2026-08-27',
};

interface TimedStop {
  id: string;
  arrivalOffsetSeconds: number;
  departureOffsetSeconds: number;
  timingSource: 'published' | 'interpolated';
}

const published = (
  id: string,
  arrivalOffsetSeconds: number,
  departureOffsetSeconds = arrivalOffsetSeconds,
): TimedStop => ({
  id,
  arrivalOffsetSeconds,
  departureOffsetSeconds,
  timingSource: 'published',
});

const interpolated = (id: string, offsetSeconds: number): TimedStop => ({
  id,
  arrivalOffsetSeconds: offsetSeconds,
  departureOffsetSeconds: offsetSeconds,
  timingSource: 'interpolated',
});

// Stop order and raw IDs come from Duke's current TransLoc public live-map data. The five
// published timetable checkpoints remain exact; other offsets are scaled between those anchors
// using TransLoc's SecondsToNextStop values. This data is bundled so the app still works offline.
const daytimeStops: TimedStop[] = [
  published('TL-200', 0),
  interpolated('TL-201', 78),
  interpolated('TL-202', 149),
  published('TL-270', 180),
  interpolated('TL-203', 363),
  published('TL-90', 600, 720),
  interpolated('TL-188', 749),
  interpolated('TL-189', 771),
  interpolated('TL-190', 825),
  interpolated('TL-278', 841),
  interpolated('TL-192', 871),
  interpolated('TL-193', 950),
  published('TL-195', 1_020),
  interpolated('TL-196', 1_041),
  interpolated('TL-197', 1_070),
  interpolated('TL-198', 1_098),
  interpolated('TL-199', 1_130),
  published('TL-200', 1_200),
];

// The latest official evening table conflicts with the current TransLoc route-stop order, so only
// its explicitly timed stops are included until Duke reconciles the two sources.
const eveningStops: TimedStop[] = [
  published('TL-216', 0),
  published('TL-221', 240),
  published('TL-269', 600),
  published('TL-206', 720),
  published('TL-205', 780, 1_080),
  published('TL-216', 1_200),
];

const eveningDepartures = [
  18 * 3_600,
  19 * 3_600,
  19 * 3_600 + 1_800,
  20 * 3_600,
  20 * 3_600 + 1_800,
  21 * 3_600,
  21 * 3_600 + 1_800,
];

const legacyStopIdsByRoute: Record<string, Record<string, string>> = {
  'TL-13': {
    [`${DUKE_OFFICIAL_SCHEDULE_PREFIX}stop:12030`]: 'TL-200',
    [`${DUKE_OFFICIAL_SCHEDULE_PREFIX}stop:12092`]: 'TL-270',
    [`${DUKE_OFFICIAL_SCHEDULE_PREFIX}stop:6647`]: 'TL-90',
    [`${DUKE_OFFICIAL_SCHEDULE_PREFIX}stop:12048`]: 'TL-195',
  },
  'TL-19': {
    [`${DUKE_OFFICIAL_SCHEDULE_PREFIX}stop:12030`]: 'TL-216',
    [`${DUKE_OFFICIAL_SCHEDULE_PREFIX}stop:5531`]: 'TL-221',
    [`${DUKE_OFFICIAL_SCHEDULE_PREFIX}stop:12047`]: 'TL-269',
    [`${DUKE_OFFICIAL_SCHEDULE_PREFIX}stop:12110`]: 'TL-206',
    [`${DUKE_OFFICIAL_SCHEDULE_PREFIX}stop:6647`]: 'TL-205',
  },
};

export function migrateDukeOfficialSelection(
  selection?: TransitSelectionDraft,
): TransitSelectionDraft | undefined {
  if (!selection?.routeId) return selection;
  const stopIds = legacyStopIdsByRoute[selection.routeId];
  if (!stopIds) return selection;
  return {
    routeId: selection.routeId,
    originStopId: selection.originStopId
      ? (stopIds[selection.originStopId] ?? selection.originStopId)
      : undefined,
    destinationStopId: selection.destinationStopId
      ? (stopIds[selection.destinationStopId] ?? selection.destinationStopId)
      : undefined,
  };
}

function makeStopTimes(tripId: string, stops: TimedStop[], startSeconds = 0): StopTime[] {
  return stops.map((stop, index) => ({
    tripId,
    stopId: stop.id,
    arrivalSeconds: startSeconds + stop.arrivalOffsetSeconds,
    departureSeconds: startSeconds + stop.departureOffsetSeconds,
    stopSequence: index + 1,
    timingSource: stop.timingSource,
  }));
}

function supplementalTrip(id: string, routeId: string, includesEstimatedStopTimes = false): Trip {
  return {
    id,
    routeId,
    serviceId: SERVICE_ID,
    headsign: 'LaSalle Loop Counter Clockwise',
    scheduleSource: {
      ...SOURCE,
      label: includesEstimatedStopTimes
        ? `${SOURCE.label} (intermediate stop times estimated)`
        : SOURCE.label,
      includesEstimatedStopTimes,
    },
  };
}

export function supplementDukeOfficialSchedules(feed: GtfsFeed): GtfsFeed {
  const dayRoute = feed.routes.find(
    (route) => route.id === 'TL-13' && route.longName.startsWith('LLCCW:'),
  );
  const eveningRoute = feed.routes.find(
    (route) => route.id === 'TL-19' && route.longName.startsWith('LLCCWN:'),
  );
  const needsDay = dayRoute && !feed.trips.some((trip) => trip.routeId === dayRoute.id);
  const needsEvening = eveningRoute && !feed.trips.some((trip) => trip.routeId === eveningRoute.id);
  if (!needsDay && !needsEvening) return feed;

  const requiredStops = [...(needsDay ? daytimeStops : []), ...(needsEvening ? eveningStops : [])];
  if (requiredStops.some((required) => !feed.stops.some((stop) => stop.id === required.id))) {
    return feed;
  }

  const trips: Trip[] = [];
  const stopTimes: StopTime[] = [];
  const frequencies = [...feed.frequencies];

  if (needsDay) {
    const tripId = `${DUKE_OFFICIAL_SCHEDULE_PREFIX}llccw:weekday-day-template`;
    trips.push(supplementalTrip(tripId, dayRoute.id, true));
    stopTimes.push(...makeStopTimes(tripId, daytimeStops));
    frequencies.push({
      tripId,
      startSeconds: 7 * 3_600 + 12 * 60,
      endSeconds: 18 * 3_600,
      headwaySeconds: 24 * 60,
      exactTimes: 1,
    });
  }

  if (needsEvening) {
    for (const departureSeconds of eveningDepartures) {
      const hours = Math.floor(departureSeconds / 3_600);
      const minutes = Math.floor((departureSeconds % 3_600) / 60);
      const tripId = `${DUKE_OFFICIAL_SCHEDULE_PREFIX}llccwn:weekday-${String(hours).padStart(2, '0')}${String(minutes).padStart(2, '0')}`;
      trips.push(supplementalTrip(tripId, eveningRoute.id));
      stopTimes.push(...makeStopTimes(tripId, eveningStops, departureSeconds));
    }
  }

  const hasService = feed.calendars.some((calendar) => calendar.serviceId === SERVICE_ID);
  return {
    ...feed,
    trips: [...feed.trips, ...trips],
    stopTimes: [...feed.stopTimes, ...stopTimes],
    frequencies,
    calendars: hasService
      ? feed.calendars
      : [
          ...feed.calendars,
          {
            serviceId: SERVICE_ID,
            weekdays: [false, true, true, true, true, true, false],
            startDate: '2026-08-10',
            endDate: '2027-05-09',
          },
        ],
  };
}
