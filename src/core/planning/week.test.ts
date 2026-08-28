import { describe, expect, it } from 'vitest';
import type { ClassEvent } from '../types';
import { getUpcomingWindowEvents } from './week';

const event = (id: string, startTime: string): ClassEvent => ({
  id,
  title: id,
  startTime: new Date(startTime),
  endTime: new Date(new Date(startTime).getTime() + 60 * 60_000),
  location: 'CIEMAS 2240',
});

describe('getUpcomingWindowEvents', () => {
  it('returns future events in the next seven days in chronological order', () => {
    const now = new Date('2026-08-27T12:00:00-04:00');
    const result = getUpcomingWindowEvents(
      [
        event('day-six', '2026-09-02T09:00:00-04:00'),
        event('past', '2026-08-27T09:00:00-04:00'),
        event('today', '2026-08-27T15:00:00-04:00'),
        event('too-late', '2026-09-04T09:00:00-04:00'),
      ],
      now,
    );

    expect(result.map(({ id }) => id)).toEqual(['today', 'day-six']);
  });

  it('excludes events beyond the requested calendar-day window', () => {
    const now = new Date('2026-08-27T12:00:00Z');
    const inside = event('inside', '2026-08-28T11:30:00Z');
    const outside = event('outside', '2026-08-28T12:30:00Z');

    expect(getUpcomingWindowEvents([inside, outside], now, 1).map(({ id }) => id)).toEqual([
      'inside',
    ]);
  });
});
