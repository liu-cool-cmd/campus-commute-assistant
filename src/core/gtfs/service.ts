import type { GtfsFeed } from '../types';

export function isServiceActive(feed: GtfsFeed, serviceId: string, serviceDate: string): boolean {
  const exception = feed.calendarDates.find(
    (candidate) => candidate.serviceId === serviceId && candidate.date === serviceDate,
  );
  if (exception) return exception.exceptionType === 1;

  const calendar = feed.calendars.find((candidate) => candidate.serviceId === serviceId);
  if (!calendar || serviceDate < calendar.startDate || serviceDate > calendar.endDate) return false;
  const [year = 0, month = 1, day = 1] = serviceDate.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return calendar.weekdays[weekday] ?? false;
}
