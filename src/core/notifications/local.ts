import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { localeFor, translate } from '../../i18n';
import type { TransitAlert } from '../alerts/types';
import type { AppLanguage, ClassEvent, CommuteRecommendation, OneOffTrip } from '../types';

export function notificationId(key: string): number {
  let hash = 0;
  for (const character of key) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return Math.abs(hash || 1) % 2_147_483_647;
}

const ONE_OFF_PREFIX = 'oneoff:';

/**
 * Namespaces a one-off trip id before it is hashed into a notification id. Class and alert
 * reminders hash their own raw keys, so the prefix is what keeps a one-off trip from ever
 * landing on another reminder's id and silently replacing it.
 */
export function oneOffNotificationKey(tripId: string): string {
  return tripId.startsWith(ONE_OFF_PREFIX) ? tripId : `${ONE_OFF_PREFIX}${tripId}`;
}

const formatTime = (date: Date, language: AppLanguage) =>
  new Intl.DateTimeFormat(localeFor(language), { hour: 'numeric', minute: '2-digit' }).format(date);

export async function scheduleCommuteNotification(
  classEvent: ClassEvent,
  recommendation: CommuteRecommendation,
  language: AppLanguage,
  routeName = recommendation.route.shortName || recommendation.route.longName,
): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || recommendation.leaveAt <= new Date()) return false;

  const permission = await LocalNotifications.checkPermissions();
  const resolvedPermission =
    permission.display === 'granted' ? permission : await LocalNotifications.requestPermissions();
  if (resolvedPermission.display !== 'granted') return false;

  const id = notificationId(classEvent.id);
  await LocalNotifications.cancel({ notifications: [{ id }] });
  const transitLine = `${translate(
    language,
    recommendation.departureTimeIsExact === false ? 'notificationTakeAround' : 'notificationTakeAt',
    {
      route: routeName,
      time: formatTime(recommendation.departureTime, language),
    },
  )}${
    recommendation.waitingMinutes > 0
      ? translate(language, 'notificationWait', { minutes: recommendation.waitingMinutes })
      : ''
  }`;
  await LocalNotifications.schedule({
    notifications: [
      {
        id,
        title: translate(language, 'nextClassNotification', { title: classEvent.title }),
        body: translate(language, 'notificationBody', {
          leave: formatTime(recommendation.leaveAt, language),
          transit: transitLine,
          arrival: formatTime(recommendation.arrivalTime, language),
        }),
        schedule: { at: recommendation.leaveAt, allowWhileIdle: true },
        extra: { classId: classEvent.id },
      },
    ],
  });
  return true;
}

/**
 * Schedules the leave-time reminder for a saved one-off trip. The `oneoff:` prefix is
 * applied before hashing so a one-off trip can never share a notification id with a class
 * or an alert and silently overwrite it.
 */
export async function scheduleOneOffNotification(
  trip: OneOffTrip,
  recommendation: CommuteRecommendation,
  language: AppLanguage,
  routeName = recommendation.route.shortName || recommendation.route.longName,
): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || recommendation.leaveAt <= new Date()) return false;

  const permission = await LocalNotifications.checkPermissions();
  const resolvedPermission =
    permission.display === 'granted' ? permission : await LocalNotifications.requestPermissions();
  if (resolvedPermission.display !== 'granted') return false;

  const id = notificationId(oneOffNotificationKey(trip.id));
  await LocalNotifications.cancel({ notifications: [{ id }] });
  const transitLine = `${translate(
    language,
    recommendation.departureTimeIsExact === false ? 'notificationTakeAround' : 'notificationTakeAt',
    {
      route: routeName,
      time: formatTime(recommendation.departureTime, language),
    },
  )}${
    recommendation.waitingMinutes > 0
      ? translate(language, 'notificationWait', { minutes: recommendation.waitingMinutes })
      : ''
  }`;
  await LocalNotifications.schedule({
    notifications: [
      {
        id,
        title: translate(language, 'oneOffNotification', { title: trip.title }),
        body: translate(language, 'notificationBody', {
          leave: formatTime(recommendation.leaveAt, language),
          transit: transitLine,
          arrival: formatTime(recommendation.arrivalTime, language),
        }),
        schedule: { at: recommendation.leaveAt, allowWhileIdle: true },
        extra: { oneOffTripId: trip.id },
      },
    ],
  });
  return true;
}

/** Cancels a one-off trip's reminder. The id must be namespaced the same way it was scheduled. */
export async function cancelOneOffNotification(tripId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const id = notificationId(oneOffNotificationKey(tripId));
  await LocalNotifications.cancel({ notifications: [{ id }] });
}

const ALERT_BODY_LIMIT = 240;

/**
 * Delivers one replaceable local notification per newly seen or meaningfully
 * updated alert. Returns how many were scheduled so the caller only records the
 * dedupe state once delivery actually happened. Requires an existing alert that
 * is already active; the caller is responsible for preference filtering.
 */
export async function scheduleAlertNotifications(
  alerts: TransitAlert[],
  language: AppLanguage,
): Promise<number> {
  if (!Capacitor.isNativePlatform() || alerts.length === 0) return 0;

  const permission = await LocalNotifications.checkPermissions();
  const resolvedPermission =
    permission.display === 'granted' ? permission : await LocalNotifications.requestPermissions();
  if (resolvedPermission.display !== 'granted') return 0;

  let scheduled = 0;
  for (const alert of alerts) {
    const id = notificationId(`alert:${alert.id}`);
    const body =
      alert.message.length > ALERT_BODY_LIMIT
        ? `${alert.message.slice(0, ALERT_BODY_LIMIT - 1)}…`
        : alert.message;
    await LocalNotifications.cancel({ notifications: [{ id }] });
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: alert.title || translate(language, 'alertNotificationTitleFallback'),
          body,
          extra: { alertId: alert.id },
        },
      ],
    });
    scheduled += 1;
  }
  return scheduled;
}
