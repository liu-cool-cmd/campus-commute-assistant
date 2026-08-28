import { getDownstreamStops } from '../../core/gtfs/selection';
import type {
  CampusRouteFamily,
  GtfsFeed,
  HomeTransitDraft,
  TransitSelection,
  UserSettings,
} from '../../core/types';

export const DUKE_LLCCW_FAMILY_ID = 'duke-llccw';

export const dukeRouteFamilies: CampusRouteFamily[] = [
  {
    id: DUKE_LLCCW_FAMILY_ID,
    name: 'LLCCW',
    canonicalRouteId: 'TL-13',
    routeIds: ['TL-13', 'TL-19'],
  },
];

// These are verified route-specific IDs for the same physical platform. TL-269/TL-270 and the
// non-identical TL-278/TL-279 pair are deliberately absent.
const llccwStopVariants = [
  ['TL-90', 'TL-205'],
  ['TL-188', 'TL-206'],
  ['TL-189', 'TL-207'],
  ['TL-190', 'TL-208'],
  ['TL-192', 'TL-210'],
  ['TL-193', 'TL-211'],
  ['TL-195', 'TL-212'],
  ['TL-196', 'TL-213'],
  ['TL-197', 'TL-214'],
  ['TL-199', 'TL-215'],
  ['TL-200', 'TL-216'],
  ['TL-201', 'TL-217'],
  ['TL-203', 'TL-222'],
] as const;

function mapFamilyStop(stopId: string, targetRouteId: string): string | undefined {
  const pair = llccwStopVariants.find((ids) => ids.includes(stopId as never));
  if (!pair) return targetRouteId === 'TL-13' || targetRouteId === 'TL-19' ? stopId : undefined;
  return targetRouteId === 'TL-13' ? pair[0] : targetRouteId === 'TL-19' ? pair[1] : undefined;
}

export function resolveDukeTransitSelections(
  selection: TransitSelection,
  feed: GtfsFeed,
  _commuteAt: Date,
  routeFamilyId?: string,
): TransitSelection[] {
  if (routeFamilyId !== DUKE_LLCCW_FAMILY_ID) return [selection];

  return dukeRouteFamilies[0]!.routeIds.flatMap((routeId) => {
    const originStopId = mapFamilyStop(selection.originStopId, routeId);
    const destinationStopId = mapFamilyStop(selection.destinationStopId, routeId);
    if (!originStopId || !destinationStopId) return [];
    const isDownstream = getDownstreamStops(feed, routeId, originStopId).some(
      (stop) => stop.id === destinationStopId,
    );
    return isDownstream ? [{ routeId, originStopId, destinationStopId }] : [];
  });
}

export function migrateDukeHomeTransit(value?: HomeTransitDraft): HomeTransitDraft | undefined {
  if (!value?.routeId || value.routeFamilyId) return value;
  if (value.routeId === 'TL-13') return { ...value, routeFamilyId: DUKE_LLCCW_FAMILY_ID };
  if (value.routeId !== 'TL-19' || !value.originStopId) return value;
  const canonicalStopId = mapFamilyStop(value.originStopId, 'TL-13');
  return canonicalStopId && canonicalStopId !== value.originStopId
    ? {
        routeId: 'TL-13',
        routeFamilyId: DUKE_LLCCW_FAMILY_ID,
        originStopId: canonicalStopId,
      }
    : { ...value, routeFamilyId: DUKE_LLCCW_FAMILY_ID };
}

export function migrateDukeRouteFamilySettings(settings: UserSettings): UserSettings {
  const homeTransit = migrateDukeHomeTransit(settings.homeTransit);
  if (homeTransit?.routeFamilyId !== DUKE_LLCCW_FAMILY_ID) return { ...settings, homeTransit };
  const bindingRouteId = homeTransit.routeId === 'TL-19' ? 'TL-19' : 'TL-13';
  const migrateBindings = (bindings?: Record<string, string>) =>
    bindings
      ? Object.fromEntries(
          Object.entries(bindings).map(([key, stopId]) => [
            key,
            mapFamilyStop(stopId, bindingRouteId) ?? stopId,
          ]),
        )
      : bindings;
  return {
    ...settings,
    homeTransit,
    classStopBindings: migrateBindings(settings.classStopBindings),
    buildingStopBindings: migrateBindings(settings.buildingStopBindings),
  };
}
