import { normalizeAlertText } from './match';
import type { TransitAlert } from './types';

export interface AlertNotificationRecord {
  /** Hash of the notifiable content at the time it was last notified. */
  hash: string;
  notifiedAt: string;
}

export type AlertNotificationState = Record<string, AlertNotificationRecord>;

/**
 * Hash of everything a user would consider "the same alert". `active` and the
 * current time are intentionally excluded so an unchanged alert never
 * re-notifies just because a refresh happened.
 */
export function alertContentHash(alert: TransitAlert): string {
  return [
    alert.source,
    alert.scope,
    alert.severity,
    normalizeAlertText(alert.title ?? ''),
    normalizeAlertText(alert.message),
    [...alert.affectedRouteIds].sort().join(','),
    [...alert.affectedStopIds].sort().join(','),
    alert.startsAt?.toISOString() ?? '',
    alert.endsAt?.toISOString() ?? '',
  ].join('|');
}

export interface AlertNotificationPlan {
  /** Alerts whose content is new or meaningfully changed since the last run. */
  toNotify: TransitAlert[];
  nextState: AlertNotificationState;
}

/**
 * First appearance notifies; unchanged content does not; changed content does.
 * Only active alerts are tracked, so an alert that has expired is forgotten and
 * notifies again if it ever becomes active with new content.
 */
export function selectAlertsToNotify(
  alerts: TransitAlert[],
  previous: AlertNotificationState,
  now: Date,
): AlertNotificationPlan {
  const toNotify: TransitAlert[] = [];
  const nextState: AlertNotificationState = {};

  for (const alert of alerts) {
    if (!alert.active) continue;
    const hash = alertContentHash(alert);
    const prior = previous[alert.id];
    if (!prior) {
      toNotify.push(alert);
      nextState[alert.id] = { hash, notifiedAt: now.toISOString() };
    } else if (prior.hash !== hash) {
      toNotify.push(alert);
      nextState[alert.id] = { hash, notifiedAt: now.toISOString() };
    } else {
      nextState[alert.id] = prior;
    }
  }

  return { toNotify, nextState };
}
