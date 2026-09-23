import type { AlertNotificationScope, TransitAlert } from './types';

export interface AlertNotificationContext {
  scope: AlertNotificationScope;
  /** Saved home line, resolved variants, and the upcoming commute route. */
  routeIds: string[];
  /** Saved boarding/arrival stops and the upcoming commute stops. */
  stopIds: string[];
}

export function isImportantAlert(alert: TransitAlert): boolean {
  return alert.severity === 'important';
}

/**
 * True when an alert touches one of the user's routes/stops, or is explicitly
 * system-wide. An `unknown`-scope alert with no resolved routes/stops never
 * matches — this is what keeps unrelated alerts out of "My routes only".
 */
export function alertMatchesContext(
  alert: TransitAlert,
  context: AlertNotificationContext,
): boolean {
  if (alert.scope === 'system') return true;
  const routes = new Set(context.routeIds);
  if (alert.affectedRouteIds.some((routeId) => routes.has(routeId))) return true;
  const stops = new Set(context.stopIds);
  return alert.affectedStopIds.some((stopId) => stops.has(stopId));
}

export function shouldNotifyAlert(alert: TransitAlert, context: AlertNotificationContext): boolean {
  if (!alert.active) return false;
  switch (context.scope) {
    case 'off':
      return false;
    case 'important':
      return isImportantAlert(alert);
    case 'my-routes':
      return alertMatchesContext(alert, context);
    case 'all':
      return true;
  }
}

export function selectNotifiableAlerts(
  alerts: TransitAlert[],
  context: AlertNotificationContext,
): TransitAlert[] {
  return alerts.filter((alert) => shouldNotifyAlert(alert, context));
}

export interface AlertNotificationContextInput {
  scope: AlertNotificationScope;
  savedRouteIds?: Array<string | undefined>;
  savedStopIds?: Array<string | undefined>;
  commuteRouteIds?: Array<string | undefined>;
  commuteStopIds?: Array<string | undefined>;
}

function defined(values: Array<string | undefined>): string[] {
  return values.filter((value): value is string => Boolean(value));
}

/**
 * Unions the user's saved route/stops with the upcoming commute's route/stops.
 * The saved line is expanded to its route-family variants so a notice about a
 * sibling variant still matches.
 */
export function mergeAlertNotificationContext(
  input: AlertNotificationContextInput,
): AlertNotificationContext {
  return {
    scope: input.scope,
    routeIds: [
      ...new Set(defined([...(input.savedRouteIds ?? []), ...(input.commuteRouteIds ?? [])])),
    ],
    stopIds: [
      ...new Set(defined([...(input.savedStopIds ?? []), ...(input.commuteStopIds ?? [])])),
    ],
  };
}
