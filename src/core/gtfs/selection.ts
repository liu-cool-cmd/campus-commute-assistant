import type { GtfsFeed, Stop } from '../types';

export function getRouteStops(feed: GtfsFeed, routeId?: string): Stop[] {
  if (!routeId) return [];
  const tripIds = new Set(
    feed.trips.filter((trip) => trip.routeId === routeId).map((trip) => trip.id),
  );
  const sequenceByStop = new Map<string, number>();
  for (const stopTime of feed.stopTimes) {
    if (!tripIds.has(stopTime.tripId)) continue;
    const previous = sequenceByStop.get(stopTime.stopId);
    if (previous === undefined || stopTime.stopSequence < previous) {
      sequenceByStop.set(stopTime.stopId, stopTime.stopSequence);
    }
  }
  return [...sequenceByStop.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([stopId]) => feed.stops.find((stop) => stop.id === stopId))
    .filter((stop): stop is Stop => stop !== undefined);
}

export function getDownstreamStops(
  feed: GtfsFeed,
  routeId?: string,
  originStopId?: string,
): Stop[] {
  if (!routeId || !originStopId) return [];
  const tripIds = new Set(
    feed.trips.filter((trip) => trip.routeId === routeId).map((trip) => trip.id),
  );
  const destinationStopIds = new Set<string>();
  for (const tripId of tripIds) {
    const tripTimes = feed.stopTimes.filter((stopTime) => stopTime.tripId === tripId);
    const originSequences = tripTimes
      .filter((stopTime) => stopTime.stopId === originStopId)
      .map((stopTime) => stopTime.stopSequence);
    for (const stopTime of tripTimes) {
      if (originSequences.some((originSequence) => originSequence < stopTime.stopSequence)) {
        destinationStopIds.add(stopTime.stopId);
      }
    }
  }
  return getRouteStops(feed, routeId).filter((stop) => destinationStopIds.has(stop.id));
}
