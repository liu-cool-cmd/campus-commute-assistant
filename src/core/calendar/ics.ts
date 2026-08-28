import ICAL from 'ical.js';
import type { ClassEvent } from '../types';

const eventId = (uid: string, start: Date) => `${uid}:${start.toISOString()}`;
const stringProperty = (component: ICAL.Component, name: string): string => {
  const value = component.getFirstPropertyValue(name);
  return typeof value === 'string' ? value : '';
};

export function parseIcs(
  source: string,
  rangeStart: Date,
  rangeEnd: Date,
  maxOccurrences = 2_000,
): ClassEvent[] {
  const calendar = new ICAL.Component(ICAL.parse(source));
  const events = calendar.getAllSubcomponents('vevent');
  const output: ClassEvent[] = [];

  for (const component of events) {
    const event = new ICAL.Event(component);
    // The master event automatically relates VEVENT exceptions from the same calendar.
    if (event.isRecurrenceException()) continue;
    const location = event.location || stringProperty(component, 'location');
    const recurring = component.hasProperty('rrule') || component.hasProperty('rdate');

    if (!recurring) {
      const startTime = event.startDate.toJSDate();
      const endTime = event.endDate.toJSDate();
      if (startTime < rangeEnd && endTime > rangeStart) {
        output.push({
          id: eventId(event.uid, startTime),
          title: event.summary || 'Untitled class',
          startTime,
          endTime,
          location: String(location),
        });
      }
      continue;
    }

    const iterator = event.iterator();
    let count = 0;
    for (let next = iterator.next(); next && count < maxOccurrences; next = iterator.next()) {
      count += 1;
      const details = event.getOccurrenceDetails(next);
      const startTime = details.startDate.toJSDate();
      if (startTime >= rangeEnd) break;
      const endTime = details.endDate.toJSDate();
      if (endTime <= rangeStart) continue;
      output.push({
        id: eventId(event.uid, startTime),
        title: details.item.summary || event.summary || 'Untitled class',
        startTime,
        endTime,
        location: String(details.item.location || location),
      });
    }
  }

  return output.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
}
