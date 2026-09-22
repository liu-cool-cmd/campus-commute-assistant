import {
  DUKE_LL_FAMILY_ID,
  DUKE_LLCCW_FAMILY_ID,
  findFamilyStopByStopId,
  getFamilyStopDefinitions,
  mapFamilyStopToVariant,
  type FamilyStopDefinition,
} from '../campuses/duke/routeFamilies';
import { getDownstreamStops, getRouteStops } from '../core/gtfs/selection';
import type {
  AppLanguage,
  CampusRouteFamily,
  ClassEvent,
  GtfsFeed,
  HomeTransitDraft,
  Stop,
} from '../core/types';
import { translate } from '../i18n';

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

interface HomeTransitSettingsProps {
  language: AppLanguage;
  feed?: GtfsFeed;
  value?: HomeTransitDraft;
  routeFamilies?: CampusRouteFamily[];
  onChange(value: HomeTransitDraft): void;
}

export function HomeTransitSettings({
  language,
  feed,
  value = {},
  routeFamilies = [],
  onChange,
}: HomeTransitSettingsProps) {
  const routesWithTrips = new Set(feed?.trips.map((trip) => trip.routeId) ?? []);
  const routesWithOfficialSupplements = new Set(
    feed?.trips
      .filter((trip) => trip.scheduleSource?.kind === 'official-supplement')
      .map((trip) => trip.routeId) ?? [],
  );

  const isAutoMode = Boolean(value.routeFamilyId);
  const familyStops = isAutoMode ? getFamilyStopDefinitions(value.routeFamilyId) : [];
  const manualStops: Stop[] = !isAutoMode && feed ? getRouteStops(feed, value.routeId) : [];

  const selectValue = value.routeFamilyId ? `family:${value.routeFamilyId}` : (value.routeId ?? '');

  // LaSalle Loop grouped routes
  const clockwiseFamily = routeFamilies.find((f) => f.id === DUKE_LL_FAMILY_ID);
  const counterclockwiseFamily = routeFamilies.find((f) => f.id === DUKE_LLCCW_FAMILY_ID);
  const lasalleRouteIds = new Set(['TL-4', 'TL-17', 'TL-13', 'TL-19']);

  const findRoute = (id: string) => feed?.routes.find((r) => r.id === id);

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
          value={selectValue}
          disabled={!feed}
          onChange={(event) => {
            const selected = event.target.value;
            if (!selected) return onChange({});
            if (selected.startsWith('family:')) {
              const routeFamilyId = selected.slice('family:'.length);
              const family = routeFamilies.find((item) => item.id === routeFamilyId);
              return onChange({
                routeId: family?.canonicalRouteId ?? 'TL-13',
                routeFamilyId,
                originStopId: undefined,
              });
            }
            onChange({
              routeId: selected,
              routeFamilyId: undefined,
              originStopId: undefined,
            });
          }}
        >
          <option value="">{translate(language, 'selectLine')}</option>

          {/* LaSalle Loop Clockwise OptGroup */}
          <optgroup label={translate(language, 'lasalleClockwise')}>
            {clockwiseFamily && (
              <option value={`family:${clockwiseFamily.id}`}>
                {translate(language, 'autoMatch')} · {clockwiseFamily.name}
              </option>
            )}
            {findRoute('TL-4') && (
              <option value="TL-4">
                {routeLabel(findRoute('TL-4')!.shortName, findRoute('TL-4')!.longName, 'TL-4')} (
                {translate(language, 'daytimeOnly')})
                {routesWithOfficialSupplements.has('TL-4')
                  ? ` — ${translate(language, 'officialTimetable')}`
                  : ''}
              </option>
            )}
            {findRoute('TL-17') && (
              <option value="TL-17">
                {routeLabel(findRoute('TL-17')!.shortName, findRoute('TL-17')!.longName, 'TL-17')} (
                {translate(language, 'nightOnly')})
                {routesWithOfficialSupplements.has('TL-17')
                  ? ` — ${translate(language, 'officialTimetable')}`
                  : ''}
              </option>
            )}
          </optgroup>

          {/* LaSalle Loop Counterclockwise OptGroup */}
          <optgroup label={translate(language, 'lasalleCounterclockwise')}>
            {counterclockwiseFamily && (
              <option value={`family:${counterclockwiseFamily.id}`}>
                {translate(language, 'autoMatch')} · {counterclockwiseFamily.name}
              </option>
            )}
            {findRoute('TL-13') && (
              <option value="TL-13">
                {routeLabel(findRoute('TL-13')!.shortName, findRoute('TL-13')!.longName, 'TL-13')} (
                {translate(language, 'daytimeOnly')})
                {routesWithOfficialSupplements.has('TL-13')
                  ? ` — ${translate(language, 'officialTimetable')}`
                  : ''}
              </option>
            )}
            {findRoute('TL-19') && (
              <option value="TL-19">
                {routeLabel(findRoute('TL-19')!.shortName, findRoute('TL-19')!.longName, 'TL-19')} (
                {translate(language, 'nightOnly')})
                {routesWithOfficialSupplements.has('TL-19')
                  ? ` — ${translate(language, 'officialTimetable')}`
                  : ''}
              </option>
            )}
          </optgroup>

          {/* Other routes OptGroup */}
          <optgroup label={translate(language, 'otherRoutes')}>
            {feed?.routes
              .filter((route) => !lasalleRouteIds.has(route.id))
              .map((route) => (
                <option key={route.id} value={route.id} disabled={!routesWithTrips.has(route.id)}>
                  {routeLabel(route.shortName, route.longName, route.id)}
                  {!routesWithTrips.has(route.id) ? ` — ${translate(language, 'noTrips')}` : ''}
                  {routesWithOfficialSupplements.has(route.id)
                    ? ` — ${translate(language, 'officialTimetable')}`
                    : ''}
                </option>
              ))}
          </optgroup>
        </select>
      </label>

      <label>
        {translate(language, 'boardNearHome')}
        <select
          value={value.originStopId ?? ''}
          disabled={!feed || (!value.routeId && !value.routeFamilyId)}
          onChange={(event) =>
            onChange({
              routeId: value.routeId,
              routeFamilyId: value.routeFamilyId,
              originStopId: event.target.value || undefined,
            })
          }
        >
          <option value="">{translate(language, 'selectBoardingStop')}</option>
          {isAutoMode
            ? familyStops.map((stop) => (
                <option key={stop.id} value={stop.id}>
                  {formatFamilyStopLabel(stop, language)}
                </option>
              ))
            : manualStops.map((stop) => (
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
  routeFamilyId?: string;
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
  routeFamilyId,
  originStopId,
  classEvent,
  value,
  onChange,
  card = false,
  sharedByBuilding = false,
}: ClassDestinationFieldProps) {
  const isAutoMode = Boolean(routeFamilyId);

  // Compute downstream stops
  let destinationOptions: Array<{ id: string; label: string }> = [];

  if (isAutoMode && routeFamilyId) {
    const familyDef = routeFamiliesById(routeFamilyId);
    const definitions = getFamilyStopDefinitions(routeFamilyId);
    const candidateRouteIds = familyDef?.routeIds ?? (routeFamilyId === DUKE_LL_FAMILY_ID ? ['TL-4', 'TL-17'] : ['TL-13', 'TL-19']);

    const validDownstreamDefIds = new Set<string>();

    for (const vRouteId of candidateRouteIds) {
      const vOriginId = mapFamilyStopToVariant(routeFamilyId, originStopId, vRouteId);
      if (!vOriginId) continue;
      const vDownstream = getDownstreamStops(feed, vRouteId, vOriginId);
      for (const st of vDownstream) {
        const matched = findFamilyStopByStopId(routeFamilyId, st.id);
        if (matched) validDownstreamDefIds.add(matched.id);
      }
    }

    destinationOptions = definitions
      .filter((def) => validDownstreamDefIds.has(def.id))
      .map((def) => ({
        id: def.id,
        label: formatFamilyStopLabel(def, language),
      }));
  } else {
    const stops = getDownstreamStops(feed, routeId, originStopId);
    destinationOptions = stops.map((stop) => ({
      id: stop.id,
      label: stopLabel(stop.name, stop.code, stop.id),
    }));
  }

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
          {destinationOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
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

function routeFamiliesById(id: string): CampusRouteFamily | undefined {
  if (id === DUKE_LL_FAMILY_ID) {
    return {
      id: DUKE_LL_FAMILY_ID,
      name: 'LaSalle Loop Clockwise',
      canonicalRouteId: 'TL-4',
      routeIds: ['TL-4', 'TL-17'],
    };
  }
  if (id === DUKE_LLCCW_FAMILY_ID) {
    return {
      id: DUKE_LLCCW_FAMILY_ID,
      name: 'LaSalle Loop Counterclockwise',
      canonicalRouteId: 'TL-13',
      routeIds: ['TL-13', 'TL-19'],
    };
  }
  return undefined;
}
