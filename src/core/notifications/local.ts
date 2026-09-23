import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { localeFor, translate } from '../../i18n';
import type { TransitAlert } from '../alerts/types';
import type { AppLanguage, ClassEvent, CommuteRecommendation } from '../types';

function notificationId(classId: string): number {
  let hash = 0;
  for (const character of classId) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return Math.abs(hash || 1) % 2_147_483_647;
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
