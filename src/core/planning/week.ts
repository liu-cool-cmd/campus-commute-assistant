import type {
  CampusBuilding,
  ClassEvent,
  CommutePlan,
  GtfsFeed,
  TransitSelection,
  UserSettings,
} from '../types';
import { buildingBindingKey, classBindingKey } from '../calendar/bindings';
import { getDownstreamStops } from '../gtfs/selection';
import { findBuilding } from '../locations/geo';
import { getCommuteRecommendations } from '../routing/engine';

interface WeekPlanOptions {
  events: ClassEvent[];
  feed?: GtfsFeed;
  settings: UserSettings;
  buildings: CampusBuilding[];
  serviceTimezone: string;
  now: Date;
  days?: number;
}

export function getUpcomingWindowEvents(events: ClassEvent[], now: Date, days = 7): ClassEvent[] {
  const end = new Date(now);
  end.setDate(end.getDate() + days);
  return events
    .filter(
      (event) =>
        event.startTime.getTime() > now.getTime() && event.startTime.getTime() < end.getTime(),
    )
    .sort((left, right) => left.startTime.getTime() - right.startTime.getTime());
}

function selectionForEvent(
  event: ClassEvent,
  feed: GtfsFeed,
  settings: UserSettings,
  buildings: CampusBuilding[],
): TransitSelection | undefined {
  const routeId = settings.homeTransit?.routeId;
  const originStopId = settings.homeTransit?.originStopId;
  if (!routeId || !originStopId) return undefined;

  const key = settings.groupClassStopsByBuilding
    ? buildingBindingKey(event, buildings)
    : classBindingKey(event);
  const destinationStopId = settings.groupClassStopsByBuilding
    ? settings.buildingStopBindings?.[key]
    : settings.classStopBindings?.[key];
  if (!destinationStopId) return undefined;

  const isDownstream = getDownstreamStops(feed, routeId, originStopId).some(
    (stop) => stop.id === destinationStopId,
  );
  return isDownstream ? { routeId, originStopId, destinationStopId } : undefined;
}

export function buildWeekPlans({
  events,
  feed,
  settings,
  buildings,
  serviceTimezone,
  now,
  days = 7,
}: WeekPlanOptions): CommutePlan[] {
  return getUpcomingWindowEvents(events, now, days).map((classEvent) => {
    if (!feed) return { classEvent, status: 'schedule-loading' };
    if (!settings.homeTransit?.routeId || !settings.homeTransit.originStopId) {
      return { classEvent, status: 'home-transit-missing' };
    }

    const transitSelection = selectionForEvent(classEvent, feed, settings, buildings);
    if (!transitSelection) return { classEvent, status: 'arrival-stop-missing' };

    const originStop = feed.stops.find((stop) => stop.id === transitSelection.originStopId);
    const destinationStop = feed.stops.find(
      (stop) => stop.id === transitSelection.destinationStopId,
    );
    if (!originStop || !destinationStop) {
      return { classEvent, status: 'arrival-stop-missing' };
    }

    const recommendations = getCommuteRecommendations({
      feed,
      request: {
        origin: settings.home ?? originStop,
        destination: findBuilding(classEvent.location, buildings) ?? destinationStop,
        arrivalDeadline: classEvent.startTime,
        bufferMinutes: settings.defaultBufferMinutes,
      },
      transitSelection,
      serviceTimezone,
      walkingSpeedMetersPerSecond: settings.walkingSpeedMetersPerSecond,
      walkingCorrectionFactor: settings.walkingCorrectionFactor,
    });

    const distinct = new Map<string, (typeof recommendations)[number]>();
    for (const recommendation of recommendations) {
      const key = [
        recommendation.route.id,
        recommendation.originStop.id,
        recommendation.destinationStop.id,
        recommendation.departureTime.toISOString(),
        recommendation.arrivalTime.toISOString(),
      ].join(':');
      if (!distinct.has(key)) distinct.set(key, recommendation);
    }
    const recommendation = [...distinct.values()][0];
    return recommendation
      ? { classEvent, recommendation, status: 'ready' }
      : { classEvent, status: 'no-matching-departure' };
  });
}
