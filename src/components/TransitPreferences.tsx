import { getDownstreamStops, getRouteStops } from '../core/gtfs/selection';
import type { AppLanguage, ClassEvent, GtfsFeed, HomeTransitDraft } from '../core/types';
import { translate } from '../i18n';

const routeLabel = (shortName: string, longName: string, id: string) =>
  `${shortName || longName || id} · ${id}`;

const stopLabel = (name: string, code: string | undefined, id: string) =>
  `${name}${code ? ` (${code})` : ''} · ${id}`;

interface HomeTransitSettingsProps {
  language: AppLanguage;
  feed?: GtfsFeed;
  value?: HomeTransitDraft;
  onChange(value: HomeTransitDraft): void;
}

export function HomeTransitSettings({
  language,
  feed,
  value = {},
  onChange,
}: HomeTransitSettingsProps) {
  const routesWithTrips = new Set(feed?.trips.map((trip) => trip.routeId) ?? []);
  const routesWithOfficialSupplements = new Set(
    feed?.trips
      .filter((trip) => trip.scheduleSource?.kind === 'official-supplement')
      .map((trip) => trip.routeId) ?? [],
  );
  const stops = feed ? getRouteStops(feed, value.routeId) : [];

  return (
    <section className="settings-subsection">
      <div>
        <p className="eyebrow">{translate(language, 'homeTransit')}</p>
        <h2>{translate(language, 'defaultLineStop')}</h2>
        <p className="hint">{translate(language, 'homeTransitHint')}</p>
      </div>
      <label>
        {translate(language, 'lineFromHome')}
        <select
          value={value.routeId ?? ''}
          disabled={!feed}
          onChange={(event) => onChange(event.target.value ? { routeId: event.target.value } : {})}
        >
          <option value="">{translate(language, 'selectLine')}</option>
          {feed?.routes.map((route) => (
            <option key={route.id} value={route.id} disabled={!routesWithTrips.has(route.id)}>
              {routeLabel(route.shortName, route.longName, route.id)}
              {!routesWithTrips.has(route.id) ? ` — ${translate(language, 'noTrips')}` : ''}
              {routesWithOfficialSupplements.has(route.id)
                ? ` — ${translate(language, 'officialTimetable')}`
                : ''}
            </option>
          ))}
        </select>
      </label>
      <label>
        {translate(language, 'boardNearHome')}
        <select
          value={value.originStopId ?? ''}
          disabled={!feed || !value.routeId}
          onChange={(event) =>
            onChange({
              routeId: value.routeId,
              originStopId: event.target.value || undefined,
            })
          }
        >
          <option value="">{translate(language, 'selectBoardingStop')}</option>
          {stops.map((stop) => (
            <option key={stop.id} value={stop.id}>
              {stopLabel(stop.name, stop.code, stop.id)}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}

interface ClassDestinationFieldProps {
  language: AppLanguage;
  feed: GtfsFeed;
  routeId: string;
  originStopId: string;
  classEvent: Pick<ClassEvent, 'title' | 'location'>;
  value?: string;
  onChange(destinationStopId?: string): void;
  card?: boolean;
  sharedByBuilding?: boolean;
}

export function ClassDestinationField({
  language,
  feed,
  routeId,
  originStopId,
  classEvent,
  value,
  onChange,
  card = false,
  sharedByBuilding = false,
}: ClassDestinationFieldProps) {
  const stops = getDownstreamStops(feed, routeId, originStopId);
  const content = (
    <>
      <div className="class-binding-copy">
        <strong>{classEvent.title}</strong>
        <span>{classEvent.location || translate(language, 'locationNotProvided')}</span>
      </div>
      <label>
        {translate(language, 'getOffAt')}
        <select value={value ?? ''} onChange={(event) => onChange(event.target.value || undefined)}>
          <option value="">{translate(language, 'selectArrivalStop')}</option>
          {stops.map((stop) => (
            <option key={stop.id} value={stop.id}>
              {stopLabel(stop.name, stop.code, stop.id)}
            </option>
          ))}
        </select>
      </label>
    </>
  );

  if (card) {
    return (
      <section className="transit-selection-card class-destination-card">
        <p className="eyebrow">{translate(language, 'arrivalStopForClass')}</p>
        {content}
        <p className="hint">
          {translate(language, sharedByBuilding ? 'savedForBuilding' : 'savedForCourse')}
        </p>
      </section>
    );
  }
  return <div className="class-binding-row">{content}</div>;
}
