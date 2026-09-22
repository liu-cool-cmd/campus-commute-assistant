import { divIcon, latLngBounds } from 'leaflet';
import { useEffect } from 'react';
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
import type { AppLanguage, Coordinates, Location } from '../core/types';
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

function FitTrip({ progress }: Pick<LiveTripMapProps, 'progress'>) {
  const map = useMap();
  useEffect(() => {
    const locations: Coordinates[] = [
      progress.boardingStop,
      progress.arrivalStop,
      ...(progress.vehicle ? [progress.vehicle] : (progress.mapVehicles ?? [])),
    ].filter((point) => point !== undefined);
    if (!locations.length) locations.push(...(progress.route?.polyline ?? []));
    if (!locations.length) return;
    map.fitBounds(latLngBounds(locations.map((location) => [location.lat, location.lon])), {
      padding: [34, 34],
      maxZoom: 16,
    });
  }, [map, progress]);
  return null;
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
  const vehicleIcon = (heading = 0) =>
    divIcon({
      className: 'live-bus-marker-shell',
      html: `<span class="live-bus-marker" style="transform:rotate(${heading}deg)">▲</span>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
  const visibleVehicles = progress.vehicle ? [progress.vehicle] : (progress.mapVehicles ?? []);
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
        <button className="live-map-external-link" type="button" onClick={onOpenOfficial}>
          {translate(language, 'openFullTransloc')}
        </button>
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

            {visibleVehicles.map((vehicle) => (
              <Marker
                key={vehicle.vehicleId}
                position={[vehicle.lat, vehicle.lon]}
                icon={vehicleIcon(vehicle.bearing)}
              >
                <Popup>
                  <strong>{vehicle.name ?? vehicle.vehicleId}</strong>
                  <br />
                  {routeName}
                  <br />
                  {translate(language, 'gpsUpdated', {
                    seconds: Math.round(
                      Math.max(
                        vehicle.gpsAgeSeconds,
                        (Date.now() - vehicle.recordedAt.getTime()) / 1000,
                      ),
                    ),
                  })}
                  {vehicle.isDelayed ? (
                    <>
                      <br />
                      {translate(language, 'reportedDelayed')}
                    </>
                  ) : null}
                </Popup>
              </Marker>
            ))}
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
            <FitTrip progress={progress} />
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
                <span>
                  {translate(language, 'gpsUpdated', { seconds: progress.gpsAgeSeconds ?? 0 })}
                </span>
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
