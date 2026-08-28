import { Preferences } from '@capacitor/preferences';
import type { ClassEvent, UserSettings } from '../types';

const SETTINGS_KEY = 'user-settings-v1';
const CLASSES_KEY = 'class-events-v1';

interface StoredClassEvent extends Omit<ClassEvent, 'startTime' | 'endTime'> {
  startTime: string;
  endTime: string;
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
