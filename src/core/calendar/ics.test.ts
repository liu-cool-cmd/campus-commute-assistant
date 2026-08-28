import { describe, expect, it } from 'vitest';
import { parseIcs } from './ics';

describe('parseIcs', () => {
  it('expands recurring course events within the requested window', () => {
    const source = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Campus Commute Assistant//EN',
      'BEGIN:VEVENT',
      'UID:robotics-1',
      'DTSTART:20260824T130000Z',
      'DTEND:20260824T141500Z',
      'RRULE:FREQ=WEEKLY;COUNT=3',
      'SUMMARY:Intro to Robotics',
      'LOCATION:CIEMAS 2240',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:robotics-1',
      'RECURRENCE-ID:20260831T130000Z',
      'DTSTART:20260831T140000Z',
      'DTEND:20260831T151500Z',
      'SUMMARY:Robotics Lab',
      'LOCATION:Hudson Hall 125',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const events = parseIcs(
      source,
      new Date('2026-08-20T00:00:00Z'),
      new Date('2026-09-20T00:00:00Z'),
    );
    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({
      title: 'Intro to Robotics',
      location: 'CIEMAS 2240',
    });
    expect(events[1]).toMatchObject({ title: 'Robotics Lab', location: 'Hudson Hall 125' });
    expect(events[1]?.startTime.toISOString()).toBe('2026-08-31T14:00:00.000Z');
  });
});
