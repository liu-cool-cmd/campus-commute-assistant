import { divIcon, latLngBounds } from 'leaflet';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import type { LiveTripProgress } from '../core/realtime/routeProgress';
import type { AppLanguage, Coordinates } from '../core/types';
import { useRealtimeAge } from '../hooks/useRealtimeAge';
import { translate } from '../i18n';

interface LiveRouteOverlayProps {
  language: AppLanguage;
  routeName: string;
  progress: LiveTripProgress;
  onOpen(): void;
}

const miles = (meters: number) => (meters / 1_609.344).toFixed(1);

const points = (path?: Coordinates[]): [number, number][] =>
  path ? path.map(({ lat, lon }) => [lat, lon]) : [];

interface MiniMapViewportControllerProps {
  progress: LiveTripProgress;
}

function MiniMapViewportController({ progress }: MiniMapViewportControllerProps) {
  const map = useMap();
  const lastTripKeyRef = useRef<string>('');

  const tripKey = `${progress.route?.routeId ?? ''}:${progress.boardingStop?.id ?? ''}:${progress.arrivalStop?.id ?? ''}`;

  const calculateTargetLocations = useCallback(() => {
    const locations: Coordinates[] = [];
    if (progress.boardingStop) locations.push(progress.boardingStop);
    if (progress.vehicle) locations.push(progress.vehicle);

    // If arrival stop is close enough (within ~1500m), include it for context
    if (progress.boardingStop && progress.arrivalStop) {
      const dist = Math.hypot(
        (progress.arrivalStop.lat - progress.boardingStop.lat) * 111_000,
        (progress.arrivalStop.lon - progress.boardingStop.lon) * 111_000 * 0.81,
      );
      if (dist <= 1500) {
        locations.push(progress.arrivalStop);
      }
    }

    if (locations.length < 2 && progress.route?.polyline?.length) {
      locations.push(...progress.route.polyline.slice(0, 15));
    }
    return locations;
  }, [progress.boardingStop, progress.arrivalStop, progress.vehicle, progress.route?.polyline]);

  // Initial fit when trip changes
  useEffect(() => {
    if (tripKey && tripKey !== lastTripKeyRef.current) {
      lastTripKeyRef.current = tripKey;
      const targetLocations = calculateTargetLocations();
      if (targetLocations.length) {
        map.fitBounds(latLngBounds(targetLocations.map((l) => [l.lat, l.lon])), {
          padding: [24, 24],
          maxZoom: 16,
          animate: false,
        });
      }
    }
  }, [tripKey, calculateTargetLocations, map]);

  // Follow vehicle smoothly if it approaches boundary or moves out of the comfortable viewport
  useEffect(() => {
    if (!progress.vehicle) return;
    try {
      const currentBounds = map.getBounds();
      // Safe inner zone: 20% margin from edges
      const innerBounds = currentBounds.pad(-0.2);
      const vehicleLatLng = [progress.vehicle.lat, progress.vehicle.lon] as [number, number];

      if (!innerBounds.contains(vehicleLatLng)) {
        const targetLocations = calculateTargetLocations();
        if (targetLocations.length) {
          map.flyToBounds(latLngBounds(targetLocations.map((l) => [l.lat, l.lon])), {
            padding: [24, 24],
            maxZoom: 16,
            duration: 0.8,
          });
        }
      }
    } catch {
      // Map instance may be unmounted or sizing
    }
  }, [progress.vehicle, calculateTargetLocations, map]);

  return null;
}

export function LiveRouteOverlay({ language, routeName, progress, onOpen }: LiveRouteOverlayProps) {
  const dynamicAge = useRealtimeAge(progress.vehicle?.recordedAt) ?? progress.gpsAgeSeconds ?? 0;

  const vehicleIcon = (heading = 0, isFallback = false) =>
    divIcon({
      className: `live-bus-marker-shell ${isFallback ? 'bus-fallback' : ''}`,
      html: `<span class="live-bus-marker" style="transform:rotate(${heading}deg)">▲</span>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

  const center = progress.boardingStop ?? progress.vehicle ?? progress.route?.polyline[0];
  const hasVehicleDistance = progress.distanceToBoardingMeters !== undefined;
  const isStale = progress.status === 'stale';
  const isLive = progress.status === 'live';
  const isFallback = Boolean(progress.isFallback);

  const statusKey = isStale
    ? 'liveLocationStale'
    : progress.status === 'ambiguous'
      ? 'liveLocationAmbiguous'
      : 'liveLocationUnavailable';

  const otherVehicles = useMemo(() => {
    if (!progress.mapVehicles?.length) return [];
    return progress.mapVehicles.filter((v) => v.vehicleId !== progress.vehicle?.vehicleId);
  }, [progress.mapVehicles, progress.vehicle?.vehicleId]);

  return (
    <button
      className={`live-route-overlay live-route-${progress.status}`}
      type="button"
      onClick={onOpen}
      disabled={!progress.route}
      aria-label={`${routeName} live map`}
    >
      <div className="live-route-heading">
        <strong className="live-route-name">{routeName}</strong>
        <span
          className={`live-status-pill ${
            isLive && !isFallback
              ? 'status-live'
              : isFallback || isStale
                ? 'status-stale'
                : 'status-muted'
          }`}
        >
          {isLive && !isFallback && <span className="live-dot" />}
          {isFallback
            ? translate(language, 'lastKnownPosition')
            : isLive
              ? translate(language, 'live')
              : isStale
                ? 'STALE GPS'
                : translate(language, 'liveLocationUnavailable')}
        </span>
      </div>

      <div className="live-route-map-container">
        {center && progress.route ? (
          <div className="live-mini-map-shell">
            <MapContainer
              className="live-route-mini-map"
              center={[center.lat, center.lon]}
              zoom={15}
              zoomControl={false}
              dragging={false}
              touchZoom={false}
              scrollWheelZoom={false}
              doubleClickZoom={false}
              boxZoom={false}
              keyboard={false}
              attributionControl={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Full route polyline baseline */}
              <Polyline
                positions={points(progress.route.polyline)}
                pathOptions={{ color: '#9ba8a1', weight: 4, opacity: 0.4 }}
              />

              {/* Boarding to arrival trip path */}
              <Polyline
                positions={points(progress.boardingToArrivalPath)}
                pathOptions={{ color: '#123c31', weight: 6, opacity: 0.95 }}
              />

              {/* Vehicle to boarding approaching path */}
              <Polyline
                positions={points(progress.vehicleToBoardingPath)}
                pathOptions={{ color: '#d97745', weight: 6, opacity: 0.95 }}
              />

              {/* Route stop markers */}
              {progress.route.stops.map((stop) => {
                const isBoarding = stop.id === progress.boardingStop?.id;
                const isArrival = stop.id === progress.arrivalStop?.id;
                if (isBoarding || isArrival) return null;
                return (
                  <CircleMarker
                    key={stop.id}
                    center={[stop.lat, stop.lon]}
                    radius={3}
                    pathOptions={{
                      color: '#687e74',
                      fillColor: '#ffffff',
                      fillOpacity: 1,
                      weight: 1.5,
                    }}
                  />
                );
              })}

              {/* Boarding Stop */}
              {progress.boardingStop && (
                <CircleMarker
                  center={[progress.boardingStop.lat, progress.boardingStop.lon]}
                  radius={7}
                  pathOptions={{
                    color: '#d97745',
                    fillColor: '#ffffff',
                    fillOpacity: 1,
                    weight: 3.5,
                  }}
                />
              )}

              {/* Arrival Stop */}
              {progress.arrivalStop && (
                <CircleMarker
                  center={[progress.arrivalStop.lat, progress.arrivalStop.lon]}
                  radius={7}
                  pathOptions={{
                    color: '#ffffff',
                    fillColor: '#123c31',
                    fillOpacity: 1,
                    weight: 2,
                  }}
                />
              )}

              {/* Secondary vehicles */}
              {otherVehicles.map((v) => (
                <Marker
                  key={v.vehicleId}
                  position={[v.lat, v.lon]}
                  icon={vehicleIcon(v.bearing)}
                  opacity={0.6}
                />
              ))}

              {/* Primary vehicle */}
              {progress.vehicle && (
                <Marker
                  position={[progress.vehicle.lat, progress.vehicle.lon]}
                  icon={vehicleIcon(progress.vehicle.bearing, isFallback)}
                />
              )}

              <MiniMapViewportController progress={progress} />
            </MapContainer>
          </div>
        ) : null}

        {/* Compass North Arrow badge */}
        <div className="live-mini-map-compass" title="North Up">
          <span>N ↑</span>
        </div>
      </div>

      {hasVehicleDistance ? (
        <div className="live-route-footer">
          <div className="live-route-metrics">
            <span className="live-route-summary">
              {translate(language, 'liveDistanceSummary', {
                stops: progress.stopsAway ?? 0,
                miles: miles(progress.distanceToBoardingMeters ?? 0),
              })}
            </span>
            <span className="live-route-separator">·</span>
            <span className="live-route-age">
              {isFallback
                ? `${translate(language, 'lastKnownPosition')} · ${translate(
                    language,
                    'lastGpsAge',
                    {
                      seconds: dynamicAge,
                    },
                  )}`
                : translate(language, 'gpsUpdated', { seconds: dynamicAge })}
            </span>
          </div>

          <div className="live-route-hint">
            <span>{translate(language, 'tapForFullMap')}</span>
            <span className="live-route-arrow">→</span>
          </div>

          {progress.reason === 'seam-crossing' && (
            <span className="live-route-unavailable">
              {translate(language, 'liveLoopDistanceNote')}
            </span>
          )}
        </div>
      ) : (
        <div className="live-route-footer">
          <span className="live-route-unavailable">
            {translate(language, progress.mapVehicles?.length ? 'liveGpsOnly' : statusKey)}
          </span>
          <div className="live-route-hint">
            <span>{translate(language, 'tapForFullMap')}</span>
            <span className="live-route-arrow">→</span>
          </div>
        </div>
      )}
    </button>
  );
}
