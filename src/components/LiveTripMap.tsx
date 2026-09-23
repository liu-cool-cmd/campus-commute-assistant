import { divIcon, latLngBounds } from 'leaflet';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import type { LiveTripProgress } from '../core/realtime/routeProgress';
import type { AppLanguage, Coordinates, Location, VehiclePosition } from '../core/types';
import { useRealtimeAge } from '../hooks/useRealtimeAge';
import { translate } from '../i18n';

interface LiveTripMapProps {
  language: AppLanguage;
  routeName: string;
  progress: LiveTripProgress;
  home?: Location;
  destination?: Location;
  onClose(): void;
  onOpenOfficial(): void;
}

const points = (path: { lat: number; lon: number }[]): [number, number][] =>
  path.map(({ lat, lon }) => [lat, lon]);

interface FitTripControllerProps {
  progress: LiveTripProgress;
  recenterTrigger: number;
}

function FitTripController({ progress, recenterTrigger }: FitTripControllerProps) {
  const map = useMap();
  const lastTripKeyRef = useRef<string>('');
  const userAdjustedRef = useRef<boolean>(false);

  const tripKey = `${progress.route?.routeId ?? ''}:${progress.boardingStop?.id ?? ''}:${progress.arrivalStop?.id ?? ''}`;

  const fit = useCallback(() => {
    const locations: Coordinates[] = [];

    // Always include full route polyline so bends and outer curves are never clipped
    if (progress.route?.polyline?.length) {
      locations.push(...progress.route.polyline);
    }
    if (progress.boardingStop) locations.push(progress.boardingStop);
    if (progress.arrivalStop) locations.push(progress.arrivalStop);
    if (progress.vehicle) locations.push(progress.vehicle);
    for (const v of progress.mapVehicles ?? []) {
      locations.push(v);
    }

    if (!locations.length) return;

    // Asymmetric padding to clear the bottom floating card (.live-trip-map-summary)
    map.fitBounds(latLngBounds(locations.map((loc) => [loc.lat, loc.lon])), {
      paddingTopLeft: [28, 28],
      paddingBottomRight: [28, 96],
      animate: true,
    });
  }, [
    map,
    progress.route?.polyline,
    progress.boardingStop,
    progress.arrivalStop,
    progress.vehicle,
    progress.mapVehicles,
  ]);

  // Detect user manual dragging or zooming so vehicle ticks never override user viewport
  useEffect(() => {
    const onUserInteraction = () => {
      userAdjustedRef.current = true;
    };
    map.on('movestart', onUserInteraction);
    map.on('zoomstart', onUserInteraction);
    return () => {
      map.off('movestart', onUserInteraction);
      map.off('zoomstart', onUserInteraction);
    };
  }, [map]);

  // Fit bounds ONLY on initial mount or when route / stops genuinely change
  useEffect(() => {
    if (tripKey && tripKey !== lastTripKeyRef.current) {
      lastTripKeyRef.current = tripKey;
      userAdjustedRef.current = false;
      fit();
    }
  }, [tripKey, fit]);

  // Fit bounds when user explicitly clicks "Fit trip"
  useEffect(() => {
    if (recenterTrigger > 0) {
      userAdjustedRef.current = false;
      fit();
    }
  }, [recenterTrigger, fit]);

  return null;
}

interface LiveVehicleMarkerProps {
  vehicle: VehiclePosition;
  routeName: string;
  language: AppLanguage;
  isPrimary: boolean;
  isFallback: boolean;
  icon: ReturnType<typeof divIcon>;
}

function LiveVehicleMarker({
  vehicle,
  routeName,
  language,
  isPrimary,
  isFallback,
  icon,
}: LiveVehicleMarkerProps) {
  const dynamicAge = useRealtimeAge(vehicle.recordedAt) ?? vehicle.gpsAgeSeconds ?? 0;
  return (
    <Marker position={[vehicle.lat, vehicle.lon]} icon={icon}>
      <Popup>
        <strong>
          {vehicle.name ?? vehicle.vehicleId}
          {isPrimary ? ` (${translate(language, 'live')})` : ''}
        </strong>
        <br />
        {routeName}
        <br />
        {isFallback ? (
          <>
            <span className="live-fallback-warning">
              {translate(language, 'lastKnownPosition')}
            </span>
            <br />
            {translate(language, 'lastGpsAge', { seconds: dynamicAge })}
          </>
        ) : (
          translate(language, 'gpsUpdated', { seconds: dynamicAge })
        )}
        {vehicle.isDelayed ? (
          <>
            <br />
            {translate(language, 'reportedDelayed')}
          </>
        ) : null}
      </Popup>
    </Marker>
  );
}

export function LiveTripMap({
  language,
  routeName,
  progress,
  home,
  destination,
  onClose,
  onOpenOfficial,
}: LiveTripMapProps) {
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const dynamicAge = useRealtimeAge(progress.vehicle?.recordedAt) ?? progress.gpsAgeSeconds ?? 0;

  const vehicleIcon = (heading = 0, isFallback = false, isPrimary = true) =>
    divIcon({
      className: `live-bus-marker-shell ${isFallback ? 'bus-fallback' : ''} ${isPrimary ? 'bus-primary' : 'bus-secondary'}`,
      html: `<span class="live-bus-marker" style="transform:rotate(${heading}deg)">▲</span>`,
      iconSize: isPrimary ? [34, 34] : [28, 28],
      iconAnchor: isPrimary ? [17, 17] : [14, 14],
    });

  const visibleVehicles = useMemo(() => {
    const map = new Map<string, VehiclePosition>();
    if (progress.vehicle) {
      map.set(progress.vehicle.vehicleId, progress.vehicle);
    }
    for (const v of progress.mapVehicles ?? []) {
      if (!map.has(v.vehicleId)) {
        map.set(v.vehicleId, v);
      }
    }
    return [...map.values()];
  }, [progress.vehicle, progress.mapVehicles]);
  const center = progress.boardingStop ?? progress.route?.polyline[0];

  return (
    <section className="live-map-page live-trip-page">
      <header className="live-map-header">
        <button className="live-map-close" type="button" onClick={onClose}>
          <span aria-hidden="true">←</span> {translate(language, 'close')}
        </button>
        <strong>
          {routeName} · {translate(language, 'live')}
        </strong>
        <div className="live-map-header-actions">
          <button
            className="live-map-recenter-btn"
            type="button"
            onClick={() => setRecenterTrigger((c) => c + 1)}
            title={translate(language, 'fitTrip')}
          >
            🎯 {translate(language, 'fitTrip')}
          </button>
          <button className="live-map-external-link" type="button" onClick={onOpenOfficial}>
            {translate(language, 'openFullTransloc')}
          </button>
        </div>
      </header>

      <p className="live-map-explainer">{translate(language, 'liveTripExplanation')}</p>

      {progress.route && center ? (
        <div className="live-trip-map-shell">
          <MapContainer className="live-trip-map" center={[center.lat, center.lon]} zoom={15}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Polyline
              positions={points(progress.route.polyline)}
              pathOptions={{ color: '#9ba8a1', weight: 4, opacity: 0.35 }}
            />
            <Polyline
              positions={points(progress.passedPath)}
              pathOptions={{ color: '#9ba8a1', weight: 5, opacity: 0.45 }}
            />
            <Polyline
              positions={points(progress.vehicleToBoardingPath)}
              pathOptions={{ color: '#d97745', weight: 7, opacity: 0.95 }}
            />
            <Polyline
              positions={points(progress.boardingToArrivalPath)}
              pathOptions={{ color: '#123c31', weight: 7, opacity: 0.92 }}
            />

            {visibleVehicles.map((vehicle) => {
              const isPrimary = vehicle.vehicleId === progress.vehicle?.vehicleId;
              const isVehicleFallback = Boolean(progress.isFallback) && isPrimary;
              return (
                <LiveVehicleMarker
                  key={vehicle.vehicleId}
                  vehicle={vehicle}
                  routeName={routeName}
                  language={language}
                  isPrimary={isPrimary}
                  isFallback={isVehicleFallback}
                  icon={vehicleIcon(vehicle.bearing, isVehicleFallback, isPrimary)}
                />
              );
            })}
            {progress.boardingStop && (
              <CircleMarker
                center={[progress.boardingStop.lat, progress.boardingStop.lon]}
                radius={9}
                pathOptions={{ color: '#d97745', fillColor: '#fff', fillOpacity: 1, weight: 4 }}
              >
                <Popup>
                  {translate(language, 'boardingStop')}: {progress.boardingStop.name}
                </Popup>
              </CircleMarker>
            )}
            {progress.arrivalStop && (
              <CircleMarker
                center={[progress.arrivalStop.lat, progress.arrivalStop.lon]}
                radius={9}
                pathOptions={{ color: '#123c31', fillColor: '#d6e9dc', fillOpacity: 1, weight: 4 }}
              >
                <Popup>
                  {translate(language, 'arrivalStop')}: {progress.arrivalStop.name}
                </Popup>
              </CircleMarker>
            )}
            {home && (
              <CircleMarker
                center={[home.lat, home.lon]}
                radius={6}
                pathOptions={{ color: '#426b9a', fillOpacity: 0.8 }}
              >
                <Popup>{translate(language, 'home')}</Popup>
              </CircleMarker>
            )}
            {destination && (
              <CircleMarker
                center={[destination.lat, destination.lon]}
                radius={6}
                pathOptions={{ color: '#7a4b8f', fillOpacity: 0.8 }}
              >
                <Popup>{translate(language, 'classDestination')}</Popup>
              </CircleMarker>
            )}
            <FitTripController progress={progress} recenterTrigger={recenterTrigger} />
          </MapContainer>
          <div className="live-trip-map-summary">
            {progress.distanceToBoardingMeters !== undefined ? (
              <>
                <strong>
                  {translate(language, 'liveDistanceSummary', {
                    stops: progress.stopsAway ?? 0,
                    miles: ((progress.distanceToBoardingMeters ?? 0) / 1_609.344).toFixed(1),
                  })}
                </strong>
                {progress.isFallback ? (
                  <span className="live-route-fallback-badge">
                    {translate(language, 'lastKnownPosition')} ·{' '}
                    {translate(language, 'lastGpsAge', { seconds: dynamicAge })}
                  </span>
                ) : (
                  <span>{translate(language, 'gpsUpdated', { seconds: dynamicAge })}</span>
                )}
                {progress.reason === 'seam-crossing' && (
                  <span>{translate(language, 'liveLoopDistanceNote')}</span>
                )}
              </>
            ) : (
              <span>
                {translate(
                  language,
                  visibleVehicles.length ? 'liveGpsOnly' : 'liveLocationUnavailable',
                )}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="live-map-fallback live-trip-unavailable">
          <strong>
            {translate(
              language,
              progress.status === 'stale'
                ? 'liveLocationStale'
                : progress.status === 'ambiguous'
                  ? 'liveLocationAmbiguous'
                  : 'liveLocationUnavailable',
            )}
          </strong>
          <button className="primary-button" type="button" onClick={onOpenOfficial}>
            {translate(language, 'openFullTransloc')}
          </button>
        </div>
      )}
    </section>
  );
}
