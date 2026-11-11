import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Bell, Clock, PlusCircle, RotateCcw, Trash2 } from 'lucide-react';
import {
  getFamilyStopDefinitions,
  mapFamilyStopToVariant,
  type FamilyStopDefinition,
} from '../campuses/duke/routeFamilies';
import { getDownstreamStops, getRouteStops } from '../core/gtfs/selection';
import { arrivalStatus } from '../core/routing/arrivalStatus';
import { getCommuteRecommendations } from '../core/routing/engine';
import type {
  AppLanguage,
  CampusRouteFamily,
  GtfsFeed,
  HomeTransitDraft,
  OneOffTrip,
} from '../core/types';
import { localeFor, translate } from '../i18n';
import { RecommendationCard } from './RecommendationCard';

const routeLabel = (shortName: string, longName: string, id: string) =>
  `${shortName || longName || id} · ${id}`;

const stopLabel = (name: string, code: string | undefined, id: string) =>
  `${name}${code ? ` (${code})` : ''} · ${id}`;

function formatFamilyStopLabel(stop: FamilyStopDefinition, language: AppLanguage): string {
  const codeTag = stop.code ? ` (#${stop.code})` : '';
  if (stop.variantKind === 'day-only') {
    return `[${translate(language, 'daytimeOnly')}] ${stop.name}${codeTag}`;
  }
  if (stop.variantKind === 'night-only') {
    return `[${translate(language, 'nightOnly')}] ${stop.name}${codeTag}`;
  }
  return `${stop.name}${codeTag}`;
}

/** Defaults to the next full hour, so the form always starts on a usable value. */
function defaultArrivalValue(now = new Date()): string {
  const target = new Date(now.getTime() + 30 * 60_000);
  target.setMinutes(0, 0, 0);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}T${pad(
    target.getHours(),
  )}:${pad(target.getMinutes())}`;
}

interface OneOffTripPanelProps {
  language: AppLanguage;
  feed?: GtfsFeed;
  routeFamilies?: CampusRouteFamily[];
  /** The saved commute, used to prefill the form. */
  homeTransit?: HomeTransitDraft;
  home?: { lat: number; lon: number };
  walkingSpeedMetersPerSecond: number;
  walkingCorrectionFactor: number;
  serviceTimezone: string;
  trips: OneOffTrip[];
  onTrips(trips: OneOffTrip[]): void;
  onSchedule(trip: OneOffTrip): Promise<boolean>;
  onCancel(tripId: string): Promise<void>;
  routeName?(routeId: string, fallback: string): string;
}

export function OneOffTripPanel({
  language,
  feed,
  routeFamilies = [],
  homeTransit,
  home,
  walkingSpeedMetersPerSecond,
  walkingCorrectionFactor,
  serviceTimezone,
  trips,
  onTrips,
  onSchedule,
  onCancel,
  routeName,
}: OneOffTripPanelProps) {
  const [title, setTitle] = useState('');
  const [routeFamilyId, setRouteFamilyId] = useState<string | undefined>(
    homeTransit?.routeFamilyId,
  );
  const [routeId, setRouteId] = useState<string | undefined>(homeTransit?.routeId);
  const [originStopId, setOriginStopId] = useState<string | undefined>(homeTransit?.originStopId);
  const [destinationStopId, setDestinationStopId] = useState<string>();
  const [arrivalValue, setArrivalValue] = useState(() => defaultArrivalValue());
  const [bufferMinutes, setBufferMinutes] = useState(10);
  const [activeTripId, setActiveTripId] = useState<string>();
  const [notice, setNotice] = useState('');

  const routesWithTrips = useMemo(
    () => new Set(feed?.trips.map((trip) => trip.routeId) ?? []),
    [feed],
  );

  /** In family mode the stored id is a family id, so resolve it onto the selected variant. */
  const effectiveOriginStopId = useMemo(() => {
    if (!routeFamilyId || !originStopId || !routeId) return originStopId;
    return mapFamilyStopToVariant(routeFamilyId, originStopId, routeId) ?? originStopId;
  }, [originStopId, routeFamilyId, routeId]);

  /**
   * Family stops carry audited names and codes but no coordinate of their own, so they are
   * labelled through the family table instead of pretending to be plain GTFS stops.
   */
  const originOptions: Array<{ id: string; label: string }> = useMemo(() => {
    if (routeFamilyId) {
      return getFamilyStopDefinitions(routeFamilyId).map((definition) => ({
        id: definition.id,
        label: formatFamilyStopLabel(definition, language),
      }));
    }
    if (!feed) return [];
    return getRouteStops(feed, routeId).map((stop) => ({
      id: stop.id,
      label: stopLabel(stop.name, stop.code, stop.id),
    }));
  }, [feed, language, routeFamilyId, routeId]);

  const destinationOptions: Array<{ id: string; label: string }> = useMemo(() => {
    if (!feed || !effectiveOriginStopId) return [];
    if (routeFamilyId) {
      const family = routeFamilies.find((entry) => entry.id === routeFamilyId);
      const definitions = getFamilyStopDefinitions(routeFamilyId);
      const valid = new Set<string>();
      for (const variantId of family?.routeIds ?? [routeId ?? '']) {
        const mappedOrigin = mapFamilyStopToVariant(
          routeFamilyId,
          effectiveOriginStopId,
          variantId,
        );
        if (!mappedOrigin) continue;
        for (const stop of getDownstreamStops(feed, variantId, mappedOrigin)) {
          const matched = definitions.find((definition) => definition.id === stop.id);
          if (matched) valid.add(matched.id);
        }
      }
      return definitions
        .filter((definition) => valid.has(definition.id))
        .map((definition) => ({
          id: definition.id,
          label: formatFamilyStopLabel(definition, language),
        }));
    }
    return getDownstreamStops(feed, routeId, effectiveOriginStopId).map((stop) => ({
      id: stop.id,
      label: stopLabel(stop.name, stop.code, stop.id),
    }));
  }, [effectiveOriginStopId, feed, language, routeFamilies, routeFamilyId, routeId]);

  // A different line or boarding stop invalidates an arrival stop chosen for the previous one.
  useEffect(() => {
    setDestinationStopId(undefined);
  }, [routeId, routeFamilyId, effectiveOriginStopId]);

  const arrivalDeadline = useMemo(() => {
    const parsed = new Date(arrivalValue);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }, [arrivalValue]);

  const canEvaluate = Boolean(
    routeId && effectiveOriginStopId && destinationStopId && arrivalDeadline,
  );

  const reset = () => {
    setTitle('');
    setRouteFamilyId(homeTransit?.routeFamilyId);
    setRouteId(homeTransit?.routeId);
    setOriginStopId(homeTransit?.originStopId);
    setDestinationStopId(undefined);
    setArrivalValue(defaultArrivalValue());
    setBufferMinutes(10);
    setActiveTripId(undefined);
    setNotice('');
  };

  const create = () => {
    if (
      !canEvaluate ||
      !arrivalDeadline ||
      !routeId ||
      !effectiveOriginStopId ||
      !destinationStopId
    ) {
      return;
    }
    const trip: OneOffTrip = {
      id: `oneoff:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      title: title.trim() || translate(language, 'oneOffSection'),
      arrivalDeadline,
      routeId,
      routeFamilyId,
      originStopId: effectiveOriginStopId,
      destinationStopId,
      bufferMinutes,
      createdAt: new Date(),
    };
    onTrips([trip, ...trips]);
    setActiveTripId(trip.id);
    setNotice('');
  };

  const remove = (tripId: string) => {
    void onCancel(tripId);
    onTrips(trips.filter((entry) => entry.id !== tripId));
    if (activeTripId === tripId) setActiveTripId(undefined);
    setNotice(translate(language, 'oneOffCleared'));
  };

  const activeTrip = trips.find((trip) => trip.id === activeTripId);
  const sortedTrips = useMemo(
    () => [...trips].sort((a, b) => a.arrivalDeadline.getTime() - b.arrivalDeadline.getTime()),
    [trips],
  );

  return (
    <section className="week-plan-page one-off-page">
      <div className="section-heading week-plan-heading">
        <p className="eyebrow">{translate(language, 'oneOffSection')}</p>
        <h1>{translate(language, 'oneOffHeading')}</h1>
        <p className="hint">{translate(language, 'oneOffHint')}</p>
      </div>

      <section className="one-off-form">
        <label>
          {translate(language, 'oneOffTitle')}
          <input
            type="text"
            value={title}
            placeholder={translate(language, 'oneOffTitlePlaceholder')}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>

        <label>
          {translate(language, 'oneOffLine')}
          <select
            value={routeFamilyId ? `family:${routeFamilyId}` : (routeId ?? '')}
            disabled={!feed}
            onChange={(event) => {
              const selected = event.target.value;
              if (!selected) {
                setRouteFamilyId(undefined);
                setRouteId(undefined);
                return;
              }
              if (selected.startsWith('family:')) {
                const familyId = selected.slice('family:'.length);
                const family = routeFamilies.find((entry) => entry.id === familyId);
                setRouteFamilyId(familyId);
                setRouteId(family?.canonicalRouteId);
                return;
              }
              setRouteFamilyId(undefined);
              setRouteId(selected);
            }}
          >
            <option value="">{translate(language, 'selectLine')}</option>
            {routeFamilies.map((family) => (
              <option key={family.id} value={`family:${family.id}`}>
                {translate(language, 'autoMatch')} · {family.name}
              </option>
            ))}
            {feed?.routes
              .filter((route) => !routeFamilies.some((f) => f.routeIds.includes(route.id)))
              .map((route) => (
                <option key={route.id} value={route.id} disabled={!routesWithTrips.has(route.id)}>
                  {routeLabel(route.shortName, route.longName, route.id)}
                  {!routesWithTrips.has(route.id) ? ` — ${translate(language, 'noTrips')}` : ''}
                </option>
              ))}
          </select>
        </label>

        <label>
          {translate(language, 'oneOffBoardAt')}
          <select
            value={originStopId ?? ''}
            disabled={originOptions.length === 0}
            onChange={(event) => setOriginStopId(event.target.value || undefined)}
          >
            <option value="">{translate(language, 'selectBoardingStop')}</option>
            {originOptions.map((stop) => (
              <option key={stop.id} value={stop.id}>
                {stop.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          {translate(language, 'oneOffGetOffAt')}
          <select
            value={destinationStopId ?? ''}
            disabled={destinationOptions.length === 0}
            onChange={(event) => setDestinationStopId(event.target.value || undefined)}
          >
            <option value="">{translate(language, 'selectArrivalStop')}</option>
            {destinationOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          {translate(language, 'oneOffArriveBy')}
          <input
            type="datetime-local"
            value={arrivalValue}
            onChange={(event) => setArrivalValue(event.target.value)}
          />
        </label>

        <label>
          {translate(language, 'oneOffBuffer')}
          <input
            type="number"
            min={0}
            max={60}
            value={bufferMinutes}
            onChange={(event) =>
              setBufferMinutes(Math.max(0, Math.min(60, Number(event.target.value) || 0)))
            }
          />
        </label>
        <p className="hint">{translate(language, 'oneOffBufferHint')}</p>

        <div className="one-off-actions">
          <button type="button" className="primary-button" disabled={!canEvaluate} onClick={create}>
            <PlusCircle size={16} aria-hidden="true" />
            <span>{translate(language, 'oneOffCreate')}</span>
          </button>
          <button type="button" className="text-button" onClick={reset}>
            <RotateCcw size={15} aria-hidden="true" />
            <span>{translate(language, 'oneOffReset')}</span>
          </button>
        </div>
        {!canEvaluate && <p className="hint">{translate(language, 'oneOffNoSelection')}</p>}
      </section>

      {activeTrip && (
        <OneOffResult
          language={language}
          trip={activeTrip}
          feed={feed}
          home={home}
          walkingSpeedMetersPerSecond={walkingSpeedMetersPerSecond}
          walkingCorrectionFactor={walkingCorrectionFactor}
          serviceTimezone={serviceTimezone}
          routeName={routeName}
          onSchedule={onSchedule}
          notice={notice}
          onNotice={setNotice}
        />
      )}

      <div className="one-off-saved">
        <p className="eyebrow">{translate(language, 'oneOffSaved')}</p>
        {sortedTrips.length === 0 ? (
          <p className="hint">{translate(language, 'oneOffSavedEmpty')}</p>
        ) : (
          <ul>
            {sortedTrips.map((trip) => (
              <li key={trip.id}>
                <button
                  type="button"
                  className={`one-off-saved-item ${trip.id === activeTripId ? 'active' : ''}`}
                  onClick={() => setActiveTripId(trip.id)}
                >
                  <strong>{trip.title}</strong>
                  <span>
                    <Clock
                      size={12}
                      aria-hidden="true"
                      style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }}
                    />
                    {new Intl.DateTimeFormat(localeFor(language), {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    }).format(trip.arrivalDeadline)}
                  </span>
                </button>
                <button
                  type="button"
                  className="text-button one-off-delete-button"
                  onClick={() => remove(trip.id)}
                  title={translate(language, 'oneOffDelete')}
                  aria-label={translate(language, 'oneOffDelete')}
                >
                  <Trash2 size={16} aria-hidden="true" />
                  <span>{translate(language, 'oneOffDelete')}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

interface OneOffResultProps {
  language: AppLanguage;
  trip: OneOffTrip;
  feed?: GtfsFeed;
  home?: { lat: number; lon: number };
  walkingSpeedMetersPerSecond: number;
  walkingCorrectionFactor: number;
  serviceTimezone: string;
  routeName?(routeId: string, fallback: string): string;
  onSchedule(trip: OneOffTrip): Promise<boolean>;
  notice: string;
  onNotice(value: string): void;
}

function OneOffResult({
  language,
  trip,
  feed,
  home,
  walkingSpeedMetersPerSecond,
  walkingCorrectionFactor,
  serviceTimezone,
  routeName,
  onSchedule,
  notice,
  onNotice,
}: OneOffResultProps) {
  const { recommendations, noDeparture } = useMemo(() => {
    if (!feed) return { recommendations: [], noDeparture: false };
    const originStop = feed.stops.find((stop) => stop.id === trip.originStopId);
    const destinationStop = feed.stops.find((stop) => stop.id === trip.destinationStopId);
    if (!originStop || !destinationStop) return { recommendations: [], noDeparture: true };
    const found = getCommuteRecommendations({
      feed,
      request: {
        origin: home ?? originStop,
        destination: destinationStop,
        arrivalDeadline: trip.arrivalDeadline,
        bufferMinutes: trip.bufferMinutes,
      },
      transitSelection: {
        routeId: trip.routeId,
        originStopId: trip.originStopId,
        destinationStopId: trip.destinationStopId,
      },
      serviceTimezone,
      walkingSpeedMetersPerSecond,
      walkingCorrectionFactor,
    });
    return { recommendations: found, noDeparture: found.length === 0 };
  }, [feed, home, serviceTimezone, trip, walkingCorrectionFactor, walkingSpeedMetersPerSecond]);

  const recommended = recommendations[0];

  return (
    <div className="one-off-result">
      {!feed ? (
        <p className="hint">{translate(language, 'transitUnavailable')}</p>
      ) : noDeparture ? (
        <div className="notice-banner warning-card">
          <AlertCircle size={20} aria-hidden="true" style={{ flex: 'none' }} />
          <div>
            <strong>{translate(language, 'noMatchingDeparture')}</strong>
            <span>{translate(language, 'oneOffNoDeparture')}</span>
          </div>
        </div>
      ) : (
        recommended && (
          <>
            <RecommendationCard
              language={language}
              recommendation={recommended}
              routeName={routeName?.(
                recommended.route.id,
                recommended.route.shortName || recommended.route.longName,
              )}
              arrivalStatus={arrivalStatus(recommended.minutesEarly, trip.bufferMinutes)}
            />
            <button
              type="button"
              className="primary-button one-off-remind"
              onClick={() => {
                void onSchedule(trip).then((scheduled) =>
                  onNotice(
                    scheduled
                      ? translate(language, 'oneOffReminderSet')
                      : translate(language, 'oneOffReminderFailed'),
                  ),
                );
              }}
            >
              <Bell size={16} aria-hidden="true" />
              <span>{translate(language, 'oneOffRemind')}</span>
            </button>
          </>
        )
      )}
      {notice && <p className="hint">{notice}</p>}
    </div>
  );
}
