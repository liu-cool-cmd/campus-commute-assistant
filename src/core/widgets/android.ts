import { Capacitor, registerPlugin } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import type { AppLanguage, CommutePlan } from '../types';
import { localeFor, translate } from '../../i18n';

const WIDGET_SNAPSHOT_KEY = 'widget-plans-v1';

interface CommuteWidgetsPlugin {
  refresh(): Promise<void>;
  getBatteryOptimizationStatus(): Promise<{ exempt: boolean; supported: boolean }>;
  openBatteryOptimizationSettings(): Promise<void>;
}

const CommuteWidgets = registerPlugin<CommuteWidgetsPlugin>('CommuteWidgets');

export interface BatteryOptimizationStatus {
  exempt: boolean;
  supported: boolean;
}

const timeLabel = (date: Date, language: AppLanguage) =>
  new Intl.DateTimeFormat(localeFor(language), { hour: 'numeric', minute: '2-digit' }).format(date);

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const dayDifference = (from: Date, to: Date) =>
  Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);

/**
 * Compact day label for widget rows. The snapshot only ever covers seven days, so the weekday is
 * unambiguous and the full date stays in `dayLabel` for accessibility.
 */
const shortDayLabel = (date: Date, language: AppLanguage, today: Date): string => {
  const difference = dayDifference(today, date);
  if (difference === 0) return translate(language, 'widgetToday');
  if (difference === 1) return translate(language, 'widgetTomorrow');
  return new Intl.DateTimeFormat(localeFor(language), { weekday: 'short' }).format(date);
};

export async function syncAndroidWidgets(
  plans: CommutePlan[],
  language: AppLanguage,
  routeName?: (routeId: string, fallback: string) => string,
): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;

  const now = new Date();

  const snapshot = {
    generatedAt: now.getTime(),
    generatedAtLabel: timeLabel(now, language),
    language,
    labels: {
      next: translate(language, 'widgetNext'),
      today: translate(language, 'widgetToday'),
      todayTomorrow: translate(language, 'widgetTodayTomorrow'),
      week: translate(language, 'widgetWeek'),
      mini: translate(language, 'widgetMini'),
      noPlans: translate(language, 'widgetNoPlans'),
      leave: translate(language, 'widgetLeave'),
      openApp: translate(language, 'widgetOpenApp'),
      classAt: translate(language, 'widgetClassAt'),
      upNext: translate(language, 'widgetUpNext'),
      updated: translate(language, 'widgetUpdated'),
    },
    entries: plans.map(({ classEvent, recommendation, status }) => ({
      id: classEvent.id,
      classStart: classEvent.startTime.getTime(),
      classTitle: classEvent.title,
      location: classEvent.location,
      dayLabel: new Intl.DateTimeFormat(localeFor(language), {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }).format(classEvent.startTime),
      dayShort: shortDayLabel(classEvent.startTime, language, now),
      classTime: timeLabel(classEvent.startTime, language),
      leaveAt: recommendation?.leaveAt.getTime(),
      leaveTime: recommendation ? timeLabel(recommendation.leaveAt, language) : undefined,
      departureTime: recommendation ? timeLabel(recommendation.departureTime, language) : undefined,
      route: recommendation
        ? (routeName?.(
            recommendation.route.id,
            recommendation.route.shortName || recommendation.route.longName,
          ) ??
          (recommendation.route.shortName || recommendation.route.longName))
        : undefined,
      statusText:
        status === 'ready'
          ? ''
          : translate(
              language,
              status === 'schedule-loading'
                ? 'scheduleLoading'
                : status === 'home-transit-missing'
                  ? 'chooseHomeFirst'
                  : status === 'arrival-stop-missing'
                    ? 'weeklyArrivalStopMissing'
                    : 'noMatchingDeparture',
            ),
    })),
  };

  await Preferences.set({ key: WIDGET_SNAPSHOT_KEY, value: JSON.stringify(snapshot) });
  await CommuteWidgets.refresh();
}

export async function getBatteryOptimizationStatus(): Promise<BatteryOptimizationStatus> {
  if (Capacitor.getPlatform() !== 'android') return { exempt: false, supported: false };
  return CommuteWidgets.getBatteryOptimizationStatus();
}

export async function openBatteryOptimizationSettings(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;
  await CommuteWidgets.openBatteryOptimizationSettings();
}
