export type AlertSource = 'transloc' | 'parking-rss';

/**
 * `important` maps to the product's "Important alerts only" scope and to the
 * higher-priority events the UI can badge (suspension, detour, stop change,
 * major reduced service). Everything else is informational.
 */
export type AlertSeverity = 'info' | 'important';

/**
 * How much of the network an alert covers.
 *
 * - `routes`: the text reliably matched one or more known routes.
 * - `system`: the source text explicitly says the whole system / all Duke
 *   Transit service is affected. This is never inferred from a failed match.
 * - `unknown`: nothing reliable could be matched. This is deliberately NOT the
 *   same as "everything is affected"; the UI and notifications must not treat
 *   an `unknown` alert as campus-wide.
 */
export type AlertScope = 'system' | 'routes' | 'unknown';

export type AlertNotificationScope = 'off' | 'all' | 'my-routes' | 'important';

export interface TransitAlert {
  /** Stable, source-namespaced identifier. */
  id: string;
  source: AlertSource;
  scope: AlertScope;
  severity: AlertSeverity;
  title?: string;
  message: string;
  /** GTFS `route_id`s resolved from the alert text. */
  affectedRouteIds: string[];
  /** GTFS `stop_id`s resolved from the alert text. */
  affectedStopIds: string[];
  publishedAt?: Date;
  updatedAt?: Date;
  startsAt?: Date;
  endsAt?: Date;
  /** Derived from `startsAt`/`endsAt`; recomputed on every read. */
  active: boolean;
  link?: string;
  /** Raw Ride Systems `isAlert` flag, when the source provides one. */
  sourceIsAlert?: boolean;
}

export function isAlertActive(alert: TransitAlert, now: Date): boolean {
  const time = now.getTime();
  if (alert.startsAt && alert.startsAt.getTime() > time) return false;
  if (alert.endsAt && alert.endsAt.getTime() < time) return false;
  return true;
}

export function withActiveStatus(alert: TransitAlert, now: Date): TransitAlert {
  const active = isAlertActive(alert, now);
  return active === alert.active ? alert : { ...alert, active };
}

const severityRank: Record<AlertSeverity, number> = { important: 0, info: 1 };

function alertRecency(alert: TransitAlert): number {
  return (alert.startsAt ?? alert.publishedAt ?? alert.updatedAt)?.getTime() ?? 0;
}

/** Higher-priority alerts first, then most recent. */
export function sortAlertsForDisplay(alerts: TransitAlert[]): TransitAlert[] {
  return [...alerts].sort((left, right) => {
    if (severityRank[left.severity] !== severityRank[right.severity]) {
      return severityRank[left.severity] - severityRank[right.severity];
    }
    return alertRecency(right) - alertRecency(left);
  });
}

export function onlyActiveAlerts(alerts: TransitAlert[], now: Date): TransitAlert[] {
  return alerts.filter((alert) => isAlertActive(alert, now));
}
