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
import { AlertCircle, Crosshair } from 'lucide-react';
import { DEFAULT_STALE_AFTER_SECONDS } from '../core/realtime/routeProgress';
import { sortRoutesForExplorer, summarizeRouteVehicles } from '../core/realtime/routeExplorer';
import type { AppLanguage, RealtimeRoute, VehiclePosition } from '../core/types';
import { useRealtimeAge } from '../hooks/useRealtimeAge';
import { translate } from '../i18n';

interface RouteExplorerProps {
  language: AppLanguage;
  routes: RealtimeRoute[];
  vehicles: VehiclePosition[];
  /** Shown above the map so the user always knows what the positions are relative to. */
  home?: { lat: number; lon: number; label?: string };
}

const points = (path: { lat: number; lon: number }[]): [number, number][] =>
  path.map(({ lat, lon }) => [lat, lon]);

const busIcon = (heading = 0, isPrimary: boolean) =>
  divIcon({
    className: `live-bus-marker-shell ${isPrimary ? 'bus-primary' : 'bus-secondary'}`,
    html: `<span class="live-bus-marker" style="transform:rotate(${heading}deg)">▲</span>`,
    iconSize: isPrimary ? [34, 34] : [28, 28],
    iconAnchor: isPrimary ? [17, 17] : [14, 14],
  });

interface FitRouteControllerProps {
  route?: RealtimeRoute;
  vehicles: VehiclePosition[];
  home?: { lat: number; lon: number };
  recenterTrigger: number;
}

/**
 * Fits the whole line plus its fresh vehicles. Refits only when the selected line or
 * the vehicle set genuinely changes, and never after the user pans or zooms manually.
 */
function FitRouteController({ route, vehicles, home, recenterTrigger }: FitRouteControllerProps) {
  const map = useMap();
  const lastKeyRef = useRef('');
  const userAdjustedRef = useRef(false);
  const vehicleKey = vehicles.map((vehicle) => vehicle.vehicleId).join(',');
  const fitKey = `${route?.routeId ?? ''}:${vehicleKey}`;

  const fit = useCallback(() => {
    const locations = [...(route?.polyline ?? []), ...vehicles, ...(home ? [home] : [])];
    if (locations.length === 0) return;
    map.fitBounds(latLngBounds(locations.map((loc) => [loc.lat, loc.lon])), {
      paddingTopLeft: [28, 28],
      paddingBottomRight: [28, 28],
      animate: true,
    });
  }, [home, map, route, vehicles]);

  useEffect(() => {
    const markAdjusted = () => {
      userAdjustedRef.current = true;
    };
    map.on('movestart', markAdjusted);
    map.on('zoomstart', markAdjusted);
    return () => {
      map.off('movestart', markAdjusted);
      map.off('zoomstart', markAdjusted);
    };
  }, [map]);

  useEffect(() => {
    if (fitKey && fitKey !== lastKeyRef.current) {
      lastKeyRef.current = fitKey;
      userAdjustedRef.current = false;
      fit();
    }
  }, [fitKey, fit]);

  useEffect(() => {
    if (recenterTrigger > 0) {
      userAdjustedRef.current = false;
      fit();
    }
  }, [recenterTrigger, fit]);

  return null;
}

function VehicleMarker({
  vehicle,
  routeName,
  language,
  isPrimary,
}: {
  vehicle: VehiclePosition;
  routeName: string;
  language: AppLanguage;
  isPrimary: boolean;
}) {
  const dynamicAge = useRealtimeAge(vehicle.recordedAt) ?? vehicle.gpsAgeSeconds ?? 0;
  return (
    <Marker position={[vehicle.lat, vehicle.lon]} icon={busIcon(vehicle.bearing, isPrimary)}>
      <Popup>
        <strong>
          {vehicle.name ?? vehicle.vehicleId}
          {isPrimary ? ` (${translate(language, 'live')})` : ''}
        </strong>
        <br />
        {routeName}
        <br />
        {translate(language, 'gpsUpdated', { seconds: dynamicAge })}
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

export function RouteExplorer({ language, routes, vehicles, home }: RouteExplorerProps) {
  const [selectedRouteId, setSelectedRouteId] = useState<string>();
  const [recenterTrigger, setRecenterTrigger] = useState(0);

  const sortedRoutes = useMemo(() => sortRoutesForExplorer(routes, vehicles), [routes, vehicles]);

  // Keep a valid selection as the snapshot changes, without stealing the user's choice.
  useEffect(() => {
    if (selectedRouteId && routes.some((route) => route.routeId === selectedRouteId)) return;
    setSelectedRouteId(sortedRoutes[0]?.routeId);
  }, [routes, selectedRouteId, sortedRoutes]);

  const selectedRoute = routes.find((route) => route.routeId === selectedRouteId);

  const { fresh: freshVehicles, staleCount } = useMemo(
    () => summarizeRouteVehicles(vehicles, selectedRouteId),
    [selectedRouteId, vehicles],
  );

  if (routes.length === 0) {
    return (
      <section className="week-plan-page">
        <div className="section-heading week-plan-heading">
          <p className="eyebrow">{translate(language, 'routesSection')}</p>
          <h1>{translate(language, 'routesHeading')}</h1>
        </div>
        <div className="week-plan-empty">
          <AlertCircle size={28} aria-hidden="true" style={{ color: 'var(--amber)' }} />
          <p>{translate(language, 'routesEmpty')}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="week-plan-page route-explorer-page">
      <div className="section-heading week-plan-heading">
        <p className="eyebrow">{translate(language, 'routesSection')}</p>
        <h1>{translate(language, 'routesHeading')}</h1>
        <p className="hint">{translate(language, 'routesHint')}</p>
      </div>

      <div className="route-explorer-layout">
        <div className="route-explorer-list">
          {sortedRoutes.map((route) => {
            const count = vehicles.filter((vehicle) => vehicle.routeId === route.routeId).length;
            const isSelected = route.routeId === selectedRouteId;
            return (
              <button
                key={route.routeId}
                type="button"
                className={`route-explorer-item ${isSelected ? 'active' : ''}`}
                onClick={() => setSelectedRouteId(route.routeId)}
                aria-pressed={isSelected}
              >
                <span className="route-explorer-name">
                  {route.isRunning ? (
                    <span className="route-explorer-dot live-pulse-dot" aria-hidden="true" />
                  ) : null}
                  {route.name || route.routeId}
                </span>
                <span className="route-explorer-meta">
                  {route.routeId} ·{' '}
                  {count > 0
                    ? translate(language, 'routesVehiclesNow', { count })
                    : translate(language, 'routesNotRunning')}
                </span>
              </button>
            );
          })}
        </div>

        <div className="route-explorer-detail">
          {!selectedRoute ? (
            <p className="hint">{translate(language, 'routesSelectPrompt')}</p>
          ) : (
            <>
              <div className="route-explorer-map-shell">
                <MapContainer
                  className="route-explorer-map"
                  center={[selectedRoute.polyline[0]!.lat, selectedRoute.polyline[0]!.lon]}
                  zoom={14}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Polyline
                    positions={points(selectedRoute.polyline)}
                    pathOptions={{ color: '#9ba8a1', weight: 4, opacity: 0.45 }}
                  />
                  {selectedRoute.stops.map((stop) => (
                    <CircleMarker
                      key={`${stop.id}:${stop.order}`}
                      center={[stop.lat, stop.lon]}
                      radius={5}
                      pathOptions={{
                        color: '#123c31',
                        fillColor: '#fff',
                        fillOpacity: 1,
                        weight: 2,
                      }}
                    >
                      <Popup>
                        {stop.order}. {stop.name}
                      </Popup>
                    </CircleMarker>
                  ))}
                  {home && (
                    <CircleMarker
                      center={[home.lat, home.lon]}
                      radius={6}
                      pathOptions={{ color: '#426b9a', fillOpacity: 0.8 }}
                    >
                      <Popup>{home.label || translate(language, 'home')}</Popup>
                    </CircleMarker>
                  )}
                  {freshVehicles.map((vehicle, index) => (
                    <VehicleMarker
                      key={vehicle.vehicleId}
                      vehicle={vehicle}
                      routeName={selectedRoute.name || selectedRoute.routeId}
                      language={language}
                      isPrimary={index === 0}
                    />
                  ))}
                  <FitRouteController
                    route={selectedRoute}
                    vehicles={freshVehicles}
                    home={home}
                    recenterTrigger={recenterTrigger}
                  />
                </MapContainer>
                <button
                  className="route-explorer-recenter"
                  type="button"
                  onClick={() => setRecenterTrigger((value) => value + 1)}
                  aria-label={translate(language, 'fitTrip')}
                >
                  <Crosshair size={14} aria-hidden="true" />
                  <span>{translate(language, 'fitTrip')}</span>
                </button>
              </div>

              <div className="route-explorer-status">
                {freshVehicles.length === 0 ? (
                  <span>{translate(language, 'routesNoVehicles')}</span>
                ) : (
                  <span>
                    {translate(language, 'routesVehiclesNow', { count: freshVehicles.length })}
                  </span>
                )}
                {staleCount > 0 && (
                  <span className="route-explorer-stale">
                    {translate(language, 'routesStaleCount', {
                      count: staleCount,
                      seconds: DEFAULT_STALE_AFTER_SECONDS,
                    })}
                  </span>
                )}
              </div>

              {selectedRoute.stops.length > 0 && (
                <details className="route-explorer-stops">
                  <summary>
                    {translate(language, 'routesStopSequence')} ({selectedRoute.stops.length})
                  </summary>
                  <ol>
                    {selectedRoute.stops.map((stop) => (
                      <li key={`${stop.id}:${stop.order}`}>
                        <span>{stop.name}</span>
                        <span className="route-explorer-stop-id">{stop.id}</span>
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
