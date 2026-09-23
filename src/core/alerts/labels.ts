import { sortAlertsForDisplay } from './types';
import type { TransitAlert } from './types';

export type AlertKind = 'detour' | 'stop-change' | 'suspended' | 'service';

const SUSPENDED = /(suspend|no service|not operate|will not operate|cancel)/i;
const STOP_CHANGE =
  /(relocat|stop (?:has )?(?:been )?(?:closed|changed|moved)|stops? (?:closed|changed|moved))/i;
const DETOUR = /(detour|reroute|re-route|divert)/i;

/** Text-derived category used for the short route badge and the alert chip. */
export function classifyAlertKind(text: string): AlertKind {
  if (SUSPENDED.test(text)) return 'suspended';
  if (STOP_CHANGE.test(text)) return 'stop-change';
  if (DETOUR.test(text)) return 'detour';
  return 'service';
}

/**
 * Highest-priority active alert touching `routeId` (or the whole system),
 * reduced to a short kind for a badge. `undefined` means no badge.
 */
export function alertKindForRoute(alerts: TransitAlert[], routeId: string): AlertKind | undefined {
  const relevant = alerts.filter(
    (alert) =>
      alert.active && (alert.scope === 'system' || alert.affectedRouteIds.includes(routeId)),
  );
  const top = sortAlertsForDisplay(relevant)[0];
  return top ? classifyAlertKind(top.message) : undefined;
}
