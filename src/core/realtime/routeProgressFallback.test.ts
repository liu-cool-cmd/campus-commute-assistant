import { describe, expect, it } from 'vitest';
import type { LiveTripProgress } from './routeProgress';
import { applyLiveTripFallback } from './routeProgressFallback';

describe('applyLiveTripFallback', () => {
  const createProgress = (overrides: Partial<LiveTripProgress> = {}): LiveTripProgress => ({
    status: 'live',
    route: {
      routeId: 'route-c1',
      providerRouteId: '1',
      name: 'C1 East-West',
      isLoop: false,
      polyline: [
        { lat: 36.001, lon: -78.938 },
        { lat: 36.005, lon: -78.934 },
      ],
      stops: [
        { id: 'stop-board', name: 'East', lat: 36.001, lon: -78.938, order: 1 },
        { id: 'stop-arrive', name: 'West', lat: 36.005, lon: -78.934, order: 2 },
      ],
    },
    vehicle: {
      vehicleId: 'bus-1',
      routeId: 'route-c1',
      providerRouteId: '1',
      lat: 36.002,
      lon: -78.937,
      bearing: 90,
      groundSpeed: 12,
      gpsAgeSeconds: 5,
      isOnRoute: true,
      recordedAt: new Date('2026-09-22T17:00:00Z'),
    },
    boardingStop: { id: 'stop-board', name: 'East', lat: 36.001, lon: -78.938, order: 1 },
    arrivalStop: { id: 'stop-arrive', name: 'West', lat: 36.005, lon: -78.934, order: 2 },
    vehicleToBoardingPath: [{ lat: 36.002, lon: -78.937 }],
    boardingToArrivalPath: [],
    passedPath: [],
    displayStops: [],
    distanceToBoardingMeters: 300,
    stopsAway: 1,
    gpsAgeSeconds: 5,
    ...overrides,
  });

  it('updates lastKnownGood when current progress is reliable and live', () => {
    const liveProgress = createProgress();
    const result = applyLiveTripFallback(liveProgress, undefined, new Date('2026-09-22T17:00:05Z'));

    expect(result.progress.status).toBe('live');
    expect(result.progress.isFallback).toBeFalsy();
    expect(result.nextLastKnownGood).toBe(liveProgress);
  });

  it('falls back to lastKnownGood when current snapshot is momentarily unavailable within 40s', () => {
    const lastGood = createProgress({
      vehicle: {
        ...createProgress().vehicle!,
        recordedAt: new Date('2026-09-22T17:00:00Z'),
      },
    });

    const unavailableProgress: LiveTripProgress = {
      status: 'unavailable',
      reason: 'no-active-vehicle',
      route: lastGood.route,
      boardingStop: lastGood.boardingStop,
      arrivalStop: lastGood.arrivalStop,
      vehicleToBoardingPath: [],
      boardingToArrivalPath: [],
      passedPath: [],
      displayStops: [],
    };

    // 25 seconds later, within 40s threshold
    const now = new Date('2026-09-22T17:00:25Z');
    const result = applyLiveTripFallback(unavailableProgress, lastGood, now, 40);

    expect(result.progress.status).toBe('stale');
    expect(result.progress.reason).toBe('stale-gps');
    expect(result.progress.isFallback).toBe(true);
    expect(result.progress.vehicle?.lat).toBe(36.002);
    expect(result.progress.gpsAgeSeconds).toBe(25);
    expect(result.nextLastKnownGood).toBe(lastGood);
  });

  it('expires fallback and returns unavailable when observation age exceeds max threshold', () => {
    const lastGood = createProgress({
      vehicle: {
        ...createProgress().vehicle!,
        recordedAt: new Date('2026-09-22T17:00:00Z'),
      },
    });

    const unavailableProgress: LiveTripProgress = {
      status: 'unavailable',
      reason: 'no-active-vehicle',
      route: lastGood.route,
      boardingStop: lastGood.boardingStop,
      arrivalStop: lastGood.arrivalStop,
      vehicleToBoardingPath: [],
      boardingToArrivalPath: [],
      passedPath: [],
      displayStops: [],
    };

    // 45 seconds later, exceeds 40s threshold
    const now = new Date('2026-09-22T17:00:45Z');
    const result = applyLiveTripFallback(unavailableProgress, lastGood, now, 40);

    expect(result.progress.status).toBe('unavailable');
    expect(result.progress.isFallback).toBeFalsy();
    expect(result.nextLastKnownGood).toBeUndefined();
  });

  it('immediately restores live status once a new reliable snapshot arrives', () => {
    const lastGood = createProgress({
      vehicle: {
        ...createProgress().vehicle!,
        recordedAt: new Date('2026-09-22T17:00:00Z'),
      },
    });

    // Fresh snapshot arrives with updated coordinates
    const freshLive = createProgress({
      vehicle: {
        ...createProgress().vehicle!,
        lat: 36.003,
        recordedAt: new Date('2026-09-22T17:00:15Z'),
        gpsAgeSeconds: 2,
      },
    });

    const result = applyLiveTripFallback(freshLive, lastGood, new Date('2026-09-22T17:00:17Z'));

    expect(result.progress.status).toBe('live');
    expect(result.progress.isFallback).toBeFalsy();
    expect(result.progress.vehicle?.lat).toBe(36.003);
    expect(result.nextLastKnownGood).toBe(freshLive);
  });

  it('invalidates fallback if route or stops change', () => {
    const lastGood = createProgress({
      route: {
        ...createProgress().route!,
        routeId: 'route-c1',
      },
    });

    const differentRouteProgress: LiveTripProgress = {
      status: 'unavailable',
      reason: 'no-active-vehicle',
      route: {
        ...lastGood.route!,
        routeId: 'route-llccw',
      },
      boardingStop: lastGood.boardingStop,
      arrivalStop: lastGood.arrivalStop,
      vehicleToBoardingPath: [],
      boardingToArrivalPath: [],
      passedPath: [],
      displayStops: [],
    };

    const result = applyLiveTripFallback(
      differentRouteProgress,
      lastGood,
      new Date('2026-09-22T17:00:10Z'),
    );

    expect(result.progress.status).toBe('unavailable');
    expect(result.progress.isFallback).toBeFalsy();
    expect(result.nextLastKnownGood).toBeUndefined();
  });
});
