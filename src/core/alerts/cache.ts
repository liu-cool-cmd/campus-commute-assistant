import { Preferences } from '@capacitor/preferences';
import type { AlertNotificationState } from './dedupe';
import type { TransitAlert } from './types';

const ALERTS_KEY = 'transit-alerts-v1';
const NOTIFY_STATE_KEY = 'transit-alert-notify-state-v1';

type StoredAlert = Omit<TransitAlert, 'publishedAt' | 'updatedAt' | 'startsAt' | 'endsAt'> & {
  publishedAt?: string;
  updatedAt?: string;
  startsAt?: string;
  endsAt?: string;
};

const toDate = (value?: string): Date | undefined => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const toIso = (value?: Date): string | undefined => value?.toISOString();

export async function loadCachedAlerts(): Promise<TransitAlert[]> {
  const { value } = await Preferences.get({ key: ALERTS_KEY });
  if (!value) return [];
  try {
    const stored = JSON.parse(value) as StoredAlert[];
    return stored.map((alert) => ({
      ...alert,
      publishedAt: toDate(alert.publishedAt),
      updatedAt: toDate(alert.updatedAt),
      startsAt: toDate(alert.startsAt),
      endsAt: toDate(alert.endsAt),
    }));
  } catch {
    return [];
  }
}

export async function saveCachedAlerts(alerts: TransitAlert[]): Promise<void> {
  const stored: StoredAlert[] = alerts.map((alert) => ({
    ...alert,
    publishedAt: toIso(alert.publishedAt),
    updatedAt: toIso(alert.updatedAt),
    startsAt: toIso(alert.startsAt),
    endsAt: toIso(alert.endsAt),
  }));
  await Preferences.set({ key: ALERTS_KEY, value: JSON.stringify(stored) });
}

export async function loadAlertNotificationState(): Promise<AlertNotificationState> {
  const { value } = await Preferences.get({ key: NOTIFY_STATE_KEY });
  if (!value) return {};
  try {
    return JSON.parse(value) as AlertNotificationState;
  } catch {
    return {};
  }
}

export async function saveAlertNotificationState(state: AlertNotificationState): Promise<void> {
  await Preferences.set({ key: NOTIFY_STATE_KEY, value: JSON.stringify(state) });
}
