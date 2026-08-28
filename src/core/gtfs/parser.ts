import { strFromU8, unzipSync } from 'fflate';
import type {
  FrequencyEntry,
  GtfsFeed,
  ServiceCalendar,
  ServiceException,
  ShapePoint,
  Stop,
  StopTime,
  TransitRoute,
  Trip,
} from '../types';
import { parseCsv, type CsvRow } from './csv';
import { parseGtfsDate, parseGtfsTime } from './time';

const requiredFiles = ['stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt', 'calendar.txt'];

function required(row: CsvRow, field: string, file: string): string {
  const value = row[field];
  if (!value) throw new Error(`${file}: missing ${field}`);
  return value;
}

function rows(files: Record<string, Uint8Array>, filename: string, optional = false): CsvRow[] {
  const match = Object.entries(files).find(([path]) => path.toLowerCase().endsWith(filename));
  if (!match) {
    if (optional) return [];
    throw new Error(`GTFS feed is missing ${filename}`);
  }
  return parseCsv(strFromU8(match[1]));
}

export function parseGtfsZip(input: ArrayBuffer | Uint8Array): GtfsFeed {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const files = unzipSync(bytes);
  for (const filename of requiredFiles) rows(files, filename);

  const stops: Stop[] = rows(files, 'stops.txt').map((row) => ({
    id: required(row, 'stop_id', 'stops.txt'),
    name: required(row, 'stop_name', 'stops.txt'),
    code: row.stop_code || undefined,
    lat: Number(required(row, 'stop_lat', 'stops.txt')),
    lon: Number(required(row, 'stop_lon', 'stops.txt')),
  }));

  const routes: TransitRoute[] = rows(files, 'routes.txt').map((row) => ({
    id: required(row, 'route_id', 'routes.txt'),
    shortName: row.route_short_name ?? '',
    longName: row.route_long_name ?? '',
    type: Number(row.route_type || 3),
    color: row.route_color || undefined,
    textColor: row.route_text_color || undefined,
  }));

  const trips: Trip[] = rows(files, 'trips.txt').map((row) => ({
    id: required(row, 'trip_id', 'trips.txt'),
    routeId: required(row, 'route_id', 'trips.txt'),
    serviceId: required(row, 'service_id', 'trips.txt'),
    headsign: row.trip_headsign || undefined,
    directionId: row.direction_id === '' ? undefined : Number(row.direction_id),
    shapeId: row.shape_id || undefined,
  }));

  const stopTimes: StopTime[] = rows(files, 'stop_times.txt').map((row) => ({
    tripId: required(row, 'trip_id', 'stop_times.txt'),
    stopId: required(row, 'stop_id', 'stop_times.txt'),
    arrivalSeconds: parseGtfsTime(required(row, 'arrival_time', 'stop_times.txt')),
    departureSeconds: parseGtfsTime(required(row, 'departure_time', 'stop_times.txt')),
    stopSequence: Number(required(row, 'stop_sequence', 'stop_times.txt')),
  }));

  const tripIds = new Set(trips.map((trip) => trip.id));
  const frequencies: FrequencyEntry[] = rows(files, 'frequencies.txt', true).map((row) => {
    const tripId = required(row, 'trip_id', 'frequencies.txt');
    if (!tripIds.has(tripId)) {
      throw new Error(`frequencies.txt: unknown trip_id ${tripId}`);
    }
    const startSeconds = parseGtfsTime(required(row, 'start_time', 'frequencies.txt'));
    const endSeconds = parseGtfsTime(required(row, 'end_time', 'frequencies.txt'));
    const headwaySeconds = Number(required(row, 'headway_secs', 'frequencies.txt'));
    if (!Number.isInteger(headwaySeconds) || headwaySeconds <= 0) {
      throw new Error(`frequencies.txt: invalid headway_secs for trip ${tripId}`);
    }
    if (endSeconds <= startSeconds) {
      throw new Error(`frequencies.txt: end_time must be after start_time for trip ${tripId}`);
    }
    const exactTimesValue = row.exact_times ?? '';
    if (exactTimesValue !== '' && exactTimesValue !== '0' && exactTimesValue !== '1') {
      throw new Error(`frequencies.txt: invalid exact_times for trip ${tripId}`);
    }
    return {
      tripId,
      startSeconds,
      endSeconds,
      headwaySeconds,
      exactTimes: exactTimesValue === '1' ? 1 : 0,
    };
  });

  const weekdayFields = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ] as const;
  const calendars: ServiceCalendar[] = rows(files, 'calendar.txt').map((row) => ({
    serviceId: required(row, 'service_id', 'calendar.txt'),
    weekdays: weekdayFields.map((field) => row[field] === '1') as ServiceCalendar['weekdays'],
    startDate: parseGtfsDate(required(row, 'start_date', 'calendar.txt')),
    endDate: parseGtfsDate(required(row, 'end_date', 'calendar.txt')),
  }));

  const calendarDates: ServiceException[] = rows(files, 'calendar_dates.txt', true).map((row) => ({
    serviceId: required(row, 'service_id', 'calendar_dates.txt'),
    date: parseGtfsDate(required(row, 'date', 'calendar_dates.txt')),
    exceptionType: Number(required(row, 'exception_type', 'calendar_dates.txt')) as 1 | 2,
  }));

  const shapes: ShapePoint[] = rows(files, 'shapes.txt', true).map((row) => ({
    shapeId: required(row, 'shape_id', 'shapes.txt'),
    lat: Number(required(row, 'shape_pt_lat', 'shapes.txt')),
    lon: Number(required(row, 'shape_pt_lon', 'shapes.txt')),
    sequence: Number(required(row, 'shape_pt_sequence', 'shapes.txt')),
  }));

  return { stops, routes, trips, stopTimes, frequencies, calendars, calendarDates, shapes };
}
