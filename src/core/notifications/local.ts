import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { localeFor, translate } from '../../i18n';
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
      route: recommendation.route.shortName || recommendation.route.longName,
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
