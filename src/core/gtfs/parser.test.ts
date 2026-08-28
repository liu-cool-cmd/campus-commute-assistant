import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { parseGtfsZip } from './parser';

const encode = (value: string) => strToU8(value);

describe('parseGtfsZip', () => {
  it('parses required tables, quoted CSV, exceptions, and optional shapes', () => {
    const zip = zipSync({
      'stops.txt': encode(
        'stop_id,stop_name,stop_lat,stop_lon\r\ns1,"Science, Drive",36.1,-78.9\r\n',
      ),
      'routes.txt': encode(
        'route_id,route_short_name,route_long_name,route_type\nr1,C1,Campus,3\n',
      ),
      'trips.txt': encode('route_id,service_id,trip_id,shape_id\nr1,weekday,t1,shape1\n'),
      'stop_times.txt': encode(
        'trip_id,arrival_time,departure_time,stop_id,stop_sequence\nt1,25:01:00,25:02:00,s1,1\n',
      ),
      'calendar.txt': encode(
        'service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nweekday,1,1,1,1,1,0,0,20260101,20261231\n',
      ),
      'calendar_dates.txt': encode('service_id,date,exception_type\nweekday,20260824,2\n'),
      'frequencies.txt': encode(
        'trip_id,start_time,end_time,headway_secs\nt1,25:00:00,26:00:00,600\n',
      ),
      'shapes.txt': encode(
        'shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence\nshape1,36.1,-78.9,1\n',
      ),
    });
    const feed = parseGtfsZip(zip);

    expect(feed.stops[0]?.name).toBe('Science, Drive');
    expect(feed.routes[0]?.id).toBe('r1');
    expect(feed.trips[0]?.id).toBe('t1');
    expect(feed.stopTimes[0]?.arrivalSeconds).toBe(90_060);
    expect(feed.calendars[0]?.weekdays).toEqual([false, true, true, true, true, true, false]);
    expect(feed.calendarDates[0]?.exceptionType).toBe(2);
    expect(feed.frequencies[0]).toEqual({
      tripId: 't1',
      startSeconds: 90_000,
      endSeconds: 93_600,
      headwaySeconds: 600,
      exactTimes: 0,
    });
    expect(feed.shapes).toHaveLength(1);
  });
});
