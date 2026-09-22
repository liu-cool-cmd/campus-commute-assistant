// Offline maintainer tool: parse previously downloaded official HTML, emit reviewed JSON to stdout.
// It does not fetch data or write files. Stop columns are deliberately mapped explicitly.
import { readFileSync } from 'node:fs';
const definitions = [
  {
    page: 'c1',
    slug: 'c1-east-west',
    table: 0,
    routeId: 'TL-3',
    days: [1, 2, 3, 4, 5],
    stops: ['TL-14', 'TL-16', 'TL-22', 'TL-22', 'TL-187', 'TL-14'],
  },
  // Weekend numeric stop codes on the official page conflict with its column headings.
  // These columns use the same named/directional timing points as the weekday table.
  {
    page: 'c1',
    slug: 'c1-east-west',
    table: 1,
    routeId: 'TL-3',
    days: [0, 6],
    stops: ['TL-14', 'TL-16', 'TL-22', 'TL-22', 'TL-187', 'TL-14'],
  },
  {
    page: 'sws-swift-avenue-shuttle',
    table: 0,
    routeId: 'TL-6',
    days: [1, 2, 3, 4, 5],
    stops: ['TL-43', 'TL-179', 'TL-180', 'TL-180', 'TL-37', 'TL-37', 'TL-42', 'TL-42', 'TL-43'],
  },
  {
    page: 'sws-swift-avenue-shuttle',
    table: 1,
    routeId: 'TL-6',
    days: [0, 6],
    stops: ['TL-43', 'TL-179', 'TL-180', 'TL-37', 'TL-37', 'TL-42', 'TL-42', 'TL-43'],
  },
  {
    page: 'pr1-bassett-research',
    table: 0,
    routeId: 'TL-21',
    days: [1, 2, 3, 4, 5],
    stops: ['TL-254', 'TL-259', 'TL-262', 'TL-267', 'TL-267', 'TL-270', 'TL-273', 'TL-254'],
  },
  {
    page: 'h2-hospital-loop',
    table: 0,
    routeId: 'TL-2',
    days: [1, 2, 3, 4, 5],
    stops: ['TL-10', 'TL-13', 'TL-10'],
  },
  // H Lot outbound has no verified matching stop ID: leave that column unmapped.
  {
    page: 'h1-remote-health-system-lots',
    table: 0,
    routeId: 'TL-5',
    days: [1, 2, 3, 4, 5],
    stops: ['TL-111', 'TL-116', 'TL-117', 'TL-32', 'TL-132', null, 'TL-295'],
  },
  // Only unambiguous LNC timing points. Do not alias nearby stops or changed topology.
  {
    page: 'lnc-lancaster-commons',
    table: 0,
    routeId: 'TL-9',
    days: [0, 1, 2, 3, 4, 5, 6],
    stops: ['TL-71', null, 'TL-748', 'TL-73', 'TL-73', null, 'TL-204', 'TL-71'],
  },
  {
    page: 'lnc-lancaster-commons',
    table: 2,
    routeId: 'TL-16',
    days: [1, 2, 3, 4, 5],
    stops: ['TL-152', null, 'TL-749', 'TL-154', 'TL-149', 'TL-149', null, 'TL-151', 'TL-152'],
  },
  {
    page: 'lnc-lancaster-commons',
    table: 2,
    routeId: 'TL-16',
    days: [0, 6],
    stops: ['TL-152', null, 'TL-749', 'TL-154', 'TL-149', 'TL-149', null, 'TL-151', 'TL-152'],
    lastStart: 18 * 60 + 30,
  },
];
const datasets = definitions.map((definition) => {
  const html = readFileSync(`research/transloc/samples/${definition.page}.html`, 'utf8');
  const table = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)][definition.table]?.[1];
  if (!table) throw new Error(`Missing table: ${definition.page}/${definition.table}`);
  let previousStart = 0;
  const rows: (number | null)[][] = [];
  for (const row of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1]!.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      c[1]!
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\*+$/, '')
        .trim(),
    );
    if (!/^\d{1,2}:\d{2}\s*[ap]m$/i.test(cells[0] ?? '')) continue;
    if (cells.length !== definition.stops.length) throw new Error('Table column count changed');
    let previous = previousStart;
    const times = cells.map((cell) => {
      const match = cell.match(/^(\d{1,2}):(\d{2})\s*([ap])m$/i);
      if (!match) {
        if (!cell || cell.startsWith('No Stop')) return null;
        throw new Error(`Invalid time: ${cell}`);
      }
      let minutes =
        ((Number(match[1]) % 12) + (match[3]!.toLowerCase() === 'p' ? 12 : 0)) * 60 +
        Number(match[2]);
      if (minutes < previous && previous >= 23 * 60 && minutes < 60) minutes += 24 * 60;
      if (minutes < previous) throw new Error(`Non-monotonic row: ${cells.join(', ')}`);
      previous = minutes;
      return minutes;
    });
    previousStart = times[0]!;
    if (definition.lastStart !== undefined && previousStart > definition.lastStart) continue;
    rows.push(times);
  }
  if (!rows.length) throw new Error('Empty timetable');
  return {
    routeId: definition.routeId,
    days: definition.days,
    stops: definition.stops,
    rows,
    source: `https://parking.duke.edu/buses-vans/${definition.slug ?? definition.page}/`,
  };
});
console.log(
  JSON.stringify({
    verifiedOn: '2026-09-21',
    startDate: '2026-08-10',
    endDate: '2026-12-31',
    datasets,
  }),
);
