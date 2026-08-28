export function parseGtfsTime(value: string): number {
  const match = /^(\d{1,3}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid GTFS time: ${value}`);
  const [, hoursText = '', minutesText = '', secondsText = ''] = match;
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  const seconds = Number(secondsText);
  if (minutes > 59 || seconds > 59) throw new Error(`Invalid GTFS time: ${value}`);
  return hours * 3600 + minutes * 60 + seconds;
}

export function parseGtfsDate(value: string): string {
  if (!/^\d{8}$/.test(value)) throw new Error(`Invalid GTFS date: ${value}`);
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

export function formatGtfsDate(value: string): string {
  return value.replaceAll('-', '');
}

export function addServiceDays(serviceDate: string, days: number): string {
  const [year = 0, month = 1, day = 1] = serviceDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function dateInTimezone(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function timezoneParts(date: Date, timezone: string): number[] {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((candidate) => candidate.type === type)?.value ?? 0);
  return [get('year'), get('month'), get('day'), get('hour'), get('minute'), get('second')];
}

export function serviceTimeToDate(
  serviceDate: string,
  secondsAfterMidnight: number,
  timezone: string,
): Date {
  const dayOffset = Math.floor(secondsAfterMidnight / 86_400);
  const seconds = secondsAfterMidnight % 86_400;
  const adjustedDate = addServiceDays(serviceDate, dayOffset);
  const [year = 0, month = 1, day = 1] = adjustedDate.split('-').map(Number);
  const hour = Math.floor(seconds / 3600);
  const minute = Math.floor((seconds % 3600) / 60);
  const second = seconds % 60;
  const desiredUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let result = new Date(desiredUtc);

  // Converges to the instant whose wall-clock fields match the GTFS service timezone.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const [
      actualYear = 0,
      actualMonth = 1,
      actualDay = 1,
      actualHour = 0,
      actualMinute = 0,
      actualSecond = 0,
    ] = timezoneParts(result, timezone);
    const representedUtc = Date.UTC(
      actualYear,
      actualMonth - 1,
      actualDay,
      actualHour,
      actualMinute,
      actualSecond,
    );
    result = new Date(result.getTime() + desiredUtc - representedUtc);
  }
  return result;
}
