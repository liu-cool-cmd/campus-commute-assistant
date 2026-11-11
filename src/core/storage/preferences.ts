import { Preferences } from '@capacitor/preferences';
import type { ClassEvent, OneOffTrip, UserSettings } from '../types';

const SETTINGS_KEY = 'user-settings-v1';
const CLASSES_KEY = 'class-events-v1';
const ONE_OFF_TRIPS_KEY = 'one-off-trips-v1';

interface StoredClassEvent extends Omit<ClassEvent, 'startTime' | 'endTime'> {
  startTime: string;
  endTime: string;
}

interface StoredOneOffTrip extends Omit<OneOffTrip, 'arrivalDeadline' | 'createdAt'> {
  arrivalDeadline: string;
  createdAt: string;
}

export async function loadSettings(defaults: UserSettings): Promise<UserSettings> {
  const { value } = await Preferences.get({ key: SETTINGS_KEY });
  if (!value) return defaults;
  try {
    return { ...defaults, ...(JSON.parse(value) as Partial<UserSettings>) };
  } catch {
    return defaults;
  }
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  await Preferences.set({ key: SETTINGS_KEY, value: JSON.stringify(settings) });
}

export async function loadClasses(): Promise<ClassEvent[]> {
  const { value } = await Preferences.get({ key: CLASSES_KEY });
  if (!value) return [];
  try {
    return (JSON.parse(value) as StoredClassEvent[])
      .map((event) => ({
        ...event,
        startTime: new Date(event.startTime),
        endTime: new Date(event.endTime),
      }))
      .filter((event) => !Number.isNaN(event.startTime.getTime()));
  } catch {
    return [];
  }
}

export async function saveClasses(events: ClassEvent[]): Promise<void> {
  const stored: StoredClassEvent[] = events.map((event) => ({
    ...event,
    startTime: event.startTime.toISOString(),
    endTime: event.endTime.toISOString(),
  }));
  await Preferences.set({ key: CLASSES_KEY, value: JSON.stringify(stored) });
}

/**
 * Loads saved one-off trips and drops the ones whose deadline has passed, so a trip
 * never lingers as an actionable plan. Expired reminders are also cancelled natively.
 */
export async function loadOneOffTrips(now = new Date()): Promise<OneOffTrip[]> {
  const { value } = await Preferences.get({ key: ONE_OFF_TRIPS_KEY });
  if (!value) return [];
  try {
    return (JSON.parse(value) as StoredOneOffTrip[])
      .map((trip) => ({
        ...trip,
        arrivalDeadline: new Date(trip.arrivalDeadline),
        createdAt: new Date(trip.createdAt),
      }))
      .filter(
        (trip) =>
          !Number.isNaN(trip.arrivalDeadline.getTime()) &&
          trip.arrivalDeadline.getTime() > now.getTime(),
      );
  } catch {
    return [];
  }
}

export async function saveOneOffTrips(trips: OneOffTrip[]): Promise<void> {
  const stored: StoredOneOffTrip[] = trips.map((trip) => ({
    ...trip,
    arrivalDeadline: trip.arrivalDeadline.toISOString(),
    createdAt: trip.createdAt.toISOString(),
  }));
  await Preferences.set({ key: ONE_OFF_TRIPS_KEY, value: JSON.stringify(stored) });
}
