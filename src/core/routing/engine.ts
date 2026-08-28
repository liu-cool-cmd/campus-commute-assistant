import { estimateWalkingMinutes } from '../locations/geo';
import type { CommuteRecommendation, RoutingOptions, StopTime } from '../types';
import { isServiceActive } from '../gtfs/service';
import { getTripInstances } from '../gtfs/frequencies';
import { addServiceDays, dateInTimezone, serviceTimeToDate } from '../gtfs/time';

const MINUTE = 60_000;

export function getCommuteRecommendations(options: RoutingOptions): CommuteRecommendation[] {
  const {
    feed,
    request,
    transitSelection,
    serviceTimezone,
    walkingSpeedMetersPerSecond,
    walkingCorrectionFactor,
  } = options;
  const effectiveDeadline = new Date(
    request.arrivalDeadline.getTime() - request.bufferMinutes * MINUTE,
  );
  const stopById = new Map(feed.stops.map((stop) => [stop.id, stop]));
  const routeById = new Map(feed.routes.map((route) => [route.id, route]));
  const selectedOriginStop = stopById.get(transitSelection.originStopId);
  const selectedDestinationStop = stopById.get(transitSelection.destinationStopId);
  const selectedRoute = routeById.get(transitSelection.routeId);
  if (!selectedOriginStop || !selectedDestinationStop || !selectedRoute) return [];
  const timesByTrip = new Map<string, StopTime[]>();
  const frequenciesByTrip = new Map<string, typeof feed.frequencies>();

  for (const stopTime of feed.stopTimes) {
    const tripTimes = timesByTrip.get(stopTime.tripId) ?? [];
    tripTimes.push(stopTime);
    timesByTrip.set(stopTime.tripId, tripTimes);
  }
  for (const times of timesByTrip.values()) times.sort((a, b) => a.stopSequence - b.stopSequence);
  for (const frequency of feed.frequencies) {
    const tripFrequencies = frequenciesByTrip.get(frequency.tripId) ?? [];
    tripFrequencies.push(frequency);
    frequenciesByTrip.set(frequency.tripId, tripFrequencies);
  }

  const localDeadlineDate = dateInTimezone(effectiveDeadline, serviceTimezone);
  const serviceDates = [localDeadlineDate, addServiceDays(localDeadlineDate, -1)];
  const results: CommuteRecommendation[] = [];

  for (const trip of feed.trips) {
    if (trip.routeId !== transitSelection.routeId) continue;
    const times = timesByTrip.get(trip.id);
    if (!times) continue;
    const instances = getTripInstances(times, frequenciesByTrip.get(trip.id) ?? []);

    const originTimes = times.filter((time) => time.stopId === transitSelection.originStopId);
    const destinationTimes = times.filter(
      (time) => time.stopId === transitSelection.destinationStopId,
    );
    for (const originTime of originTimes) {
      for (const destinationTime of destinationTimes) {
        if (originTime.stopSequence >= destinationTime.stopSequence) continue;
        const usesInterpolatedTiming =
          originTime.timingSource === 'interpolated' ||
          destinationTime.timingSource === 'interpolated';
        const originWalkingMinutes = estimateWalkingMinutes(
          request.origin,
          selectedOriginStop,
          walkingSpeedMetersPerSecond,
          walkingCorrectionFactor,
        );
        const destinationWalkingMinutes = estimateWalkingMinutes(
          selectedDestinationStop,
          request.destination,
          walkingSpeedMetersPerSecond,
          walkingCorrectionFactor,
        );

        for (const instance of instances) {
          const waitingMinutes =
            instance.frequency?.exactTimes === 0
              ? Math.ceil(instance.frequency.headwaySeconds / 60)
              : 0;
          for (const serviceDate of serviceDates) {
            if (!isServiceActive(feed, trip.serviceId, serviceDate)) continue;
            const departureTime = serviceTimeToDate(
              serviceDate,
              originTime.departureSeconds + instance.timeOffsetSeconds,
              serviceTimezone,
            );
            const stopArrivalTime = serviceTimeToDate(
              serviceDate,
              destinationTime.arrivalSeconds + instance.timeOffsetSeconds,
              serviceTimezone,
            );
            const arrivalTime = new Date(
              stopArrivalTime.getTime() + destinationWalkingMinutes * MINUTE,
            );
            if (arrivalTime > effectiveDeadline || departureTime >= stopArrivalTime) continue;

            const leaveAt = new Date(
              departureTime.getTime() - (originWalkingMinutes + waitingMinutes) * MINUTE,
            );
            const transitMinutes = Math.ceil(
              (stopArrivalTime.getTime() - departureTime.getTime()) / MINUTE,
            );
            results.push({
              kind: 'transit',
              leaveAt,
              originStop: selectedOriginStop,
              destinationStop: selectedDestinationStop,
              route: selectedRoute,
              trip,
              departureTime,
              departureTimeIsExact:
                !usesInterpolatedTiming &&
                (instance.frequency ? instance.frequency.exactTimes === 1 : true),
              frequencyHeadwayMinutes: instance.frequency
                ? Math.ceil(instance.frequency.headwaySeconds / 60)
                : undefined,
              arrivalTime,
              walkingMinutes: originWalkingMinutes + destinationWalkingMinutes,
              waitingMinutes,
              originWalkingMinutes,
              destinationWalkingMinutes,
              transitMinutes,
              totalMinutes: Math.ceil((arrivalTime.getTime() - leaveAt.getTime()) / MINUTE),
              minutesEarly: Math.floor(
                (request.arrivalDeadline.getTime() - arrivalTime.getTime()) / MINUTE,
              ),
              confidence:
                usesInterpolatedTiming || instance.frequency?.exactTimes === 0 ? 'low' : 'medium',
            });
          }
        }
      }
    }
  }

  const unique = new Map<string, CommuteRecommendation>();
  for (const result of results) {
    const key = `${result.trip?.id}:${result.originStop?.id}:${result.destinationStop?.id}:${result.departureTime?.toISOString()}`;
    unique.set(key, result);
  }

  return [...unique.values()].sort((a, b) => b.leaveAt.getTime() - a.leaveAt.getTime());
}

export function recommendCommute(options: RoutingOptions): CommuteRecommendation | undefined {
  return getCommuteRecommendations(options)[0];
}
