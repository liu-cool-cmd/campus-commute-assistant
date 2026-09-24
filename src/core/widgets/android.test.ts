import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppLanguage, CommutePlan } from '../types';

const { refresh, set } = vi.hoisted(() => ({
  refresh: vi.fn<() => Promise<void>>(() => Promise.resolve()),
  set: vi.fn<(options: { key: string; value: string }) => Promise<void>>(() => Promise.resolve()),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'android' },
  registerPlugin: () => ({ refresh }),
}));

vi.mock('@capacitor/preferences', () => ({
  Preferences: { set },
}));

import { syncAndroidWidgets } from './android';

interface SnapshotEntry {
  id: string;
  classStart: number;
  classTitle: string;
  location: string;
  dayLabel: string;
  dayShort: string;
  classTime: string;
  leaveAt?: number;
  leaveTime?: string;
  departureTime?: string;
  route?: string;
  statusText: string;
}

interface Snapshot {
  generatedAt: number;
  generatedAtLabel: string;
  language: string;
  labels: Record<string, string>;
  entries: SnapshotEntry[];
}

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const classAt = (startTime: Date): CommutePlan => ({
  classEvent: {
    id: 'class-1',
    title: 'Calculus II',
    startTime,
    endTime: new Date(startTime.getTime() + 60 * 60_000),
    location: 'CIEMAS 2240',
  },
  status: 'ready',
  recommendation: {
    leaveAt: new Date(startTime.getTime() - 30 * 60_000),
    departureTime: new Date(startTime.getTime() - 24 * 60_000),
    route: { id: 'route-1', shortName: 'C1', longName: 'C1 Campus Loop' },
  } as unknown as CommutePlan['recommendation'],
});

const classWithoutRecommendation = (startTime: Date): CommutePlan => ({
  ...classAt(startTime),
  status: 'home-transit-missing',
  recommendation: undefined,
});

const entryAt = (snapshot: Snapshot, index: number): SnapshotEntry => {
  const entry = snapshot.entries[index];
  if (!entry) throw new Error(`the snapshot has no entry at index ${index}`);
  return entry;
};

const writeSnapshot = async (
  plans: CommutePlan[],
  language: AppLanguage = 'en',
): Promise<Snapshot> => {
  await syncAndroidWidgets(plans, language);
  expect(set).toHaveBeenCalledTimes(1);
  const options = set.mock.calls[0]?.[0];
  if (!options) throw new Error('the widget snapshot was never written');
  expect(options.key).toBe('widget-plans-v1');
  return JSON.parse(options.value) as Snapshot;
};

describe('android widget snapshot', () => {
  beforeEach(() => {
    set.mockClear();
    refresh.mockClear();
  });

  // The Java provider reads these exact keys with optString/optLong; renaming one silently
  // blanks a widget instead of failing a build, so the shape is pinned here.
  it('writes every field the Java provider reads and asks widgets to refresh', async () => {
    const snapshot = await writeSnapshot([classAt(startOfToday())]);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(snapshot.generatedAt).toEqual(expect.any(Number));
    expect(snapshot.generatedAtLabel).toEqual(expect.any(String));
    expect(Object.keys(entryAt(snapshot, 0)).sort()).toEqual([
      'classStart',
      'classTime',
      'classTitle',
      'dayLabel',
      'dayShort',
      'departureTime',
      'id',
      'leaveAt',
      'leaveTime',
      'location',
      'route',
      'statusText',
    ]);
    expect(snapshot.labels).toMatchObject({
      next: expect.any(String),
      today: expect.any(String),
      todayTomorrow: expect.any(String),
      week: expect.any(String),
      mini: expect.any(String),
      noPlans: expect.any(String),
      leave: expect.any(String),
      openApp: expect.any(String),
      classAt: expect.any(String),
      upNext: expect.any(String),
      updated: expect.any(String),
    });
  });

  it('omits recommendation fields when a plan has no departure', async () => {
    const snapshot = await writeSnapshot([classWithoutRecommendation(startOfToday())]);
    const entry = entryAt(snapshot, 0);

    expect(entry).not.toHaveProperty('leaveTime');
    expect(entry).not.toHaveProperty('departureTime');
    expect(entry).not.toHaveProperty('route');
    expect(entry.statusText).not.toBe('');
    expect(typeof entry.classStart).toBe('number');
  });

  it('labels the next two days in words and later days by weekday', async () => {
    const today = startOfToday();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const later = new Date(today);
    later.setDate(later.getDate() + 3);

    const snapshot = await writeSnapshot([classAt(today), classAt(tomorrow), classAt(later)]);

    expect(entryAt(snapshot, 0).dayShort).toBe('Today');
    expect(entryAt(snapshot, 1).dayShort).toBe('Tomorrow');
    expect(entryAt(snapshot, 2).dayShort).not.toBe('Today');
    expect(entryAt(snapshot, 2).dayShort).not.toBe('Tomorrow');
    expect(entryAt(snapshot, 2).dayShort).not.toBe('');
    expect(entryAt(snapshot, 0).dayLabel).not.toBe('');
  });

  it('uses the visible language for day labels', async () => {
    const snapshot = await writeSnapshot([classAt(startOfToday())], 'zh-CN');
    expect(entryAt(snapshot, 0).dayShort).toBe('今天');
    expect(snapshot.language).toBe('zh-CN');
  });
});
