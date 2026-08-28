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

export async function syncAndroidWidgets(
  plans: CommutePlan[],
  language: AppLanguage,
  routeName?: (routeId: string, fallback: string) => string,
): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;

  const snapshot = {
    generatedAt: Date.now(),
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
