import { useMemo } from 'react';
import type { LiveTripProgress } from '../core/realtime/routeProgress';
import type { AppLanguage } from '../core/types';
import { translate } from '../i18n';

interface LiveRouteOverlayProps {
  language: AppLanguage;
  routeName: string;
  progress: LiveTripProgress;
  onOpen(): void;
}

const miles = (meters: number) => (meters / 1_609.344).toFixed(1);

export function LiveRouteOverlay({ language, routeName, progress, onOpen }: LiveRouteOverlayProps) {
  const markers = useMemo(() => {
    if (
      progress.status !== 'live' ||
      progress.distanceToBoardingMeters === undefined ||
      progress.distanceBoardingToArrivalMeters === undefined
    ) {
      return [];
    }
    const total = Math.max(
      1,
      progress.distanceToBoardingMeters + progress.distanceBoardingToArrivalMeters,
    );
    return progress.displayStops.map((item) => ({
      ...item,
      x: 7 + Math.min(1, item.distanceFromVehicleMeters / total) * 86,
    }));
  }, [progress]);

  const statusKey =
    progress.status === 'stale'
      ? 'liveLocationStale'
      : progress.status === 'ambiguous'
        ? 'liveLocationAmbiguous'
        : 'liveLocationUnavailable';

  return (
    <button
      className={`live-route-overlay live-route-${progress.status}`}
      type="button"
      onClick={onOpen}
      disabled={progress.status !== 'live'}
    >
      <span className="live-route-heading">
        <strong>{routeName}</strong>
        <span>{translate(language, 'live')}</span>
      </span>
      {progress.status === 'live' && progress.distanceToBoardingMeters !== undefined ? (
        <>
          <svg className="live-route-diagram" viewBox="0 0 100 30" role="img">
            <title>{translate(language, 'liveRouteDiagram')}</title>
            <line x1="7" y1="15" x2="93" y2="15" />
            {markers.map((marker, index) =>
              marker.role === 'arrival' ? (
                <text key={`${marker.stop.id}-${index}`} x={marker.x} y="19" textAnchor="middle">
                  ★
                </text>
              ) : (
                <circle
                  key={`${marker.stop.id}-${index}`}
                  cx={marker.x}
                  cy="15"
                  r={marker.role === 'boarding' ? 4.4 : 2.5}
                  className={marker.role === 'boarding' ? 'boarding-marker' : ''}
                />
              ),
            )}
            <text x="7" y="11" textAnchor="middle" className="bus-glyph">
              🚌
            </text>
          </svg>
          <span className="live-route-summary">
            {translate(language, 'liveDistanceSummary', {
              stops: progress.stopsAway ?? 0,
              miles: miles(progress.distanceToBoardingMeters),
            })}
          </span>
          <span className="live-route-age">
            {translate(language, 'gpsUpdated', { seconds: progress.gpsAgeSeconds ?? 0 })}
          </span>
        </>
      ) : (
        <span className="live-route-unavailable">{translate(language, statusKey)}</span>
      )}
    </button>
  );
}
