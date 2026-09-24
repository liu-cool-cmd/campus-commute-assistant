# Campus Commute Assistant

> Never miss class because you picked the wrong campus bus.

Campus Commute Assistant works backward from the next class on your calendar. It combines the class
time, a locally cached campus GTFS schedule, the user's saved home line and boarding stop, each
course's saved arrival stop, optional walking estimates, and a configurable safety buffer to
recommend when to leave for a matching bus. It also surfaces Duke transit alerts from the TransLoc
message feed and the Parking & Transportation news feed.

The v0.1 adapter targets Duke University. The routing and data modules are campus-neutral so another
school can be added without forking the core engine.

![Campus Commute Assistant screenshot placeholder](docs/screenshot-placeholder.svg)

## What works

- Import or replace `.ics` calendars and expand recurring class events for the coming year. A
  successful replacement swaps the saved events atomically while retaining route and stop choices.
- Normalize common Duke room labels and resolve six seed buildings: CIEMAS, Hudson Hall, Gross Hall,
  LSRC, Physics, and French Family Science Center.
- Download and parse `stops`, `routes`, `trips`, `stop_times`, `calendar`, `calendar_dates`, optional
  `frequencies`, and optional `shapes` from a GTFS zip.
- Keep the last good GTFS archive in IndexedDB, refresh stale data on startup, check periodically,
  and support manual refresh.
- Save one default line and home boarding stop, bind an arrival stop to each course/location, then
  rank only matching trips by the latest safe leave time.
- Apply walking time at both ends, campus timezone rules, service exceptions, and GTFS times after
  midnight.
- Evaluate fixed-schedule and headway trips together without rewriting feed `route_id` or `trip_id`.
  Inexact headways reserve up to one full headway of waiting and are labeled low-confidence.
- Return a clear no-departure state instead of silently switching routes or stops.
- Persist settings and imported classes locally with Capacitor Preferences.
- Select Home with an explicit OpenStreetMap address search, a map pin, coordinates, or the
  device's current location.
- Switch the application UI and commute notifications between English and Simplified Chinese.
- Optionally reuse one arrival-stop binding for different rooms normalized to the same building;
  this is experimental, off by default, and does not overwrite exact course/location bindings.
- Open Duke's official TransLoc vehicle map in a near-full-screen experimental iframe, with a
  direct official-site fallback.
- Show an optional Live Trip overlay and focused Leaflet map using Duke TransLoc public vehicle
  GPS, current route geometry, and ordered stops. It reports route distance and stops to the saved
  boarding stop, never a predicted ETA.
- Replace and reschedule Android local notifications when a recommendation changes.
- Review every remaining class and its matching commute in a grouped, next-7-days plan.
- Add five Android home-screen widgets: next commute, today, today + tomorrow, next 7 days, and a
  compact Mini schedule with one upcoming day per line. They reuse the app's saved static-schedule
  results, follow the launcher resize size (dragging one taller shows more plans instead of leaving
  a gap), lead with the leave time, and follow the system light and dark theme.
- Open Android's battery optimization management screen from Settings when device power management
  delays reminders or widget refreshes.
- Build as a Vite web app or a Capacitor Android app without an application server.
- Surface Duke transit alerts from the TransLoc message feed and the Parking news RSS in a home
  summary, a dedicated Alerts tab, and per-route badges, with a configurable notification scope.
- Order the home screen so the recommended leave time and the live mini map come first, list earlier
  backups and the following departures (labelled when they may be late), and keep arrival-stop
  editing in Settings.

v0.1 is a timetable matcher, not a general journey planner. It does not search nearby stops,
substitute routes, or calculate transfers. A Home pin adds the walk to the saved boarding stop. A
recognized building adds the final walk from the class's saved arrival stop; an unknown building
does not block matching and is treated as the arrival stop itself.

## v0.2 Live Trip (phase 1)

Live Trip is an optional visualization layered on top of the unchanged static recommendation. A
single foreground cache polls vehicle positions about every 5 seconds while the home or Live Trip
screen shows a recommendation, pauses while the document is hidden, and reuses route metadata cached
for 15 minutes. Vehicle GPS is projected onto TransLoc's
directed route polyline; route distance, ordered stops, loop seams, stale data, and ambiguous
parallel/self-crossing segments are handled by the campus-neutral `core/realtime` module.

The Duke adapter maps `Vehicle.RouteID -> TransLoc Route.RouteID -> Route.GtfsId -> GTFS route_id`
exactly. It never matches names or invents `TL-*` IDs. GPS older than 60 seconds is stale, and the
provider derives `recordedAt` from response receipt time minus TransLoc's `Seconds` field because
the legacy timestamp offset is unreliable. `GroundSpeed` is retained but not displayed with an
unverified unit.

LLCCW is presented as one saved `duke-llccw` family while static matching still evaluates the raw
`TL-13` daytime and `TL-19` nighttime variants independently. Only verified same-platform stop-ID
pairs cross that adapter boundary; `TL-269`, `TL-270`, and the non-identical `TL-278/TL-279` pair
are never aliased. If a selected timing point is absent from the current rider-map route, only Live
Trip becomes unavailable—the timetable recommendation remains intact.

## Home screen

The home screen is ordered so the two things that matter most stay at the top: the recommended
departure time and the live mini map.

1. Next-class header: class name, date, location, and start time.
2. Recommended departure card: the leave time and the bus arrival time at the saved boarding stop,
   plus how early it arrives relative to the configured buffer. Walk to the stop, arrival at the
   alighting stop, the walk to class, the headway allowance, and the schedule source sit behind a
   collapsible **Details** row.
3. Read-only arrival-stop row. Arrival stops are edited in Settings; tapping the row opens Settings,
   scrolls to the class-arrival-stop section, and highlights it for a moment.
4. Live mini map (square), linking to the focused Live Trip map.
5. Active alerts, when there are any. The summary is hidden entirely when nothing is active; the
   full list always lives in the Alerts tab.
6. Other departures in one time-ordered list: up to two earlier backups (leave earlier and wait),
   then up to two departures after the recommendation. A later departure is tagged **May be late**
   when it arrives before the bell without the full buffer, and **Late** when it arrives after it.
   The recommendation itself is still only ever a departure that satisfies the buffer.
7. Compact one-line notices for the states that need action (no schedule, no home line, no matching
   departure, no home pin), then the remaining actions.

The document root never scrolls: the shell's single scroll container is the content column, so
dragging on the bottom navigation cannot move the layout, and the deep link to Settings scrolls only
that column.

## v0.4 Transit alerts

Duke transit alerts are merged from two public sources into one campus-neutral `TransitAlert`:

- the TransLoc rider-map message feed (`GetTwitterJSON`), which is the only alert channel the
  official rider map itself uses; and
- the Parking & Transportation news RSS feed.

Each alert carries a source, severity, scope, affected route/stop IDs, publish/start/end times, and an
active flag.

- **Scope is never a fallback.** `routes` means the text reliably matched known routes, `system` is
  used only when the text explicitly says the whole network is affected, and everything else stays
  `unknown`. An unmatched alert is never presented as campus-wide. Attribution is a conservative text
  match against the cached GTFS data and the audited route families; the TransLoc payload has no
  route or stop identifiers, and the app never invents a second ID table.
- **Lifecycle.** TransLoc messages use their own start/end dates. Parking items use an explicit date
  range when their text contains one, and otherwise expire 14 days after publication, so old news
  does not linger as an active alert.
- **Cadence.** Alerts refresh on their own schedule — TransLoc about every 5 minutes, Parking about
  every 20 — plus on launch and on resume. They never share the app's vehicle polling.
- **Notifications.** Settings choose Off, All alerts, My routes only (the default), or Important
  alerts only. "My routes only" matches the saved line and its variants, the upcoming commute, and
  the saved boarding and alighting stops. Seeing an unchanged alert again never re-notifies; a
  meaningful content change does. The in-app list stays available even when notifications are off.
- **No CORS on the news feed.** Android reads it through Capacitor's native HTTP bridge; web builds
  degrade to TransLoc only instead of failing.

## Notable fixes

- Loop routes start and end at the same stop (Duke Clinic is the first and last stop on both LaSalle
  Loop variants). Variant resolution now considers every occurrence of a stop within a trip instead
  of only the first, so that stop works again as an arrival stop on both LL and LLCCW.
- The week plan no longer asks for an arrival stop that is already saved: a missing binding reports
  "choose an arrival stop", while a saved stop with no usable departure at that time reports "no
  matching departure".
- The Live Trip status pill separates a loop-seam continuation (the vehicle position is reliable,
  only continued service past the route start is unconfirmed) from a genuinely unavailable position,
  and labels an ambiguous projection as ambiguous instead of "live location unavailable".
- Stale vehicle data uses a 60-second threshold; earlier documentation said 90.

## Stack

React 19, TypeScript, Vite, Capacitor 7 (Preferences, Local Notifications, Geolocation), IndexedDB,
Leaflet with OpenStreetMap, `ical.js`, `fflate`, Vitest, ESLint, and Prettier.

## Run locally

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

The app is then available at the URL printed by Vite. The first GTFS download needs internet
access; subsequent routing works from the cached archive. Map tiles and address search need
connectivity unless cached, but the saved Home location and coordinate fields remain usable
offline.

Quality commands:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run gtfs:validate
```

## Android build

Install Android Studio, Android SDK 35, and JDK 21. The native project is committed under `android/`.

```bash
npm install
npm run android:sync
npm run android:open
```

Choose **Build > Build APK(s)** in Android Studio, or build a debug APK from a terminal:

```bash
cd android
./gradlew assembleDebug
```

The debug APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. Android 13 and newer
ask for notification permission when the first future commute reminder or alert notification is
scheduled. The manifest
declares coarse and fine location access, but runtime permission is requested only after **Use
current location** is pressed; searching an address or dropping a pin never requests GPS access.

Five widgets appear under **Campus Commute Assistant** in the Android widget picker. Open the app
after changing a calendar, stop, language, buffer, or GTFS data so it can publish a fresh local
next-7-days snapshot. Widgets re-render the saved snapshot at most every 30 minutes and discard
classes once their start time has passed; they do not download GTFS or run a second routing engine.

Each widget measures itself and shows as many plans as fit: today and today + tomorrow are bounded
only by how many classes remain in their window, the list widgets cap at eight rows, and the Mini
schedule caps at one row per day. Below 180dp wide the time column is dropped and the leave time
leads the row; the next-commute widget adds an "up next" list once it is dragged taller. The list
footer repeats the snapshot's publish time, so a stale widget is visible without opening the app.

The battery button opens Android's standard battery-optimization list. It does not silently exempt
the app and the manifest intentionally does not request `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`,
which keeps the behavior explicit and suitable for ordinary Play-distributed applications.

## Local-first data flow

```text
.ics file -> recurring classes -> local Preferences
                                      |
GTFS zip -> IndexedDB -> parsed feed -+-> exact route/stop matcher -> UI + notification
                                      |
saved home stop + per-class stop -----+
                                      |
                                      +-> 7-day local snapshot -> Android widgets

TransLoc messages + Parking RSS -> alert cache (Preferences) -> Alerts tab + alert notification
```

Preferences is used for small settings and course data. The binary GTFS archive is kept in
IndexedDB because Capacitor Preferences is not designed for large values. Refresh errors never
delete the last usable feed.

Home address search uses the public OpenStreetMap Nominatim endpoint for this small MVP. It runs
only on an explicit Search submission (never as autocomplete), limits and rate-limits results,
caches repeat queries for the current session, and shows OpenStreetMap attribution. Set
`VITE_NOMINATIM_URL` at build time to use another compatible endpoint. A larger public deployment
should use a hosted provider or its own Nominatim instance rather than relying on the community
server.

## Campus adapter architecture

```text
src/
  core/
    calendar/       # iCalendar expansion and stable class binding keys
    gtfs/           # parsing, service dates, cache, downloads and stop selection
    locations/      # building normalization and walking estimates
    routing/        # selected route/stop timetable matcher
    realtime/       # provider contract
    notifications/  # native reminder scheduling
    alerts/         # transit alert model, RSS, matching, dedupe
    storage/        # local settings and classes
  campuses/
    duke/
      config.ts
      buildings.ts
      realtime.ts
      alerts.ts
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the boundaries and routing scope.

### Add another school

1. Create `src/campuses/<school>/`.
2. Export a `CampusAdapter` with an IANA timezone, public GTFS URL, refresh interval, and building
   aliases/coordinates.
3. Supply a `RealtimeProvider`. It may report `available = false`; static routing must still work.
4. Register the adapter in `src/campuses/index.ts` and add source notes and tests.

No core routing branch should inspect a campus ID.

## Duke data sources

Static schedules use Duke's current TransLoc-hosted GTFS download:

- [Duke/TransLoc GTFS zip](https://duke.transloc.com/Secure/Admin/Reports/GTFSDownload.aspx)
- [Duke Parking & Transportation bus routes](https://parking.duke.edu/buses-vans/)
- [Official LL Counter Clockwise 2026–2027 timetable](https://parking.duke.edu/buses-vans/ll-lasalle-loop-counter-clockwise/)
- [Transitland's Duke feed record](https://www.transit.land/feeds/f-dnrug-duke~nc~us)

The GTFS URL was verified on 2026-08-27 to return an `application/zip` response with CORS enabled.
The development server also provides a same-origin compatibility proxy. Native Android requests use
Capacitor's HTTP bridge.

Duke uses TransLoc for rider-facing live vehicle tracking. On 2026-08-27, the same public rider map
was verified to expose keyless vehicle-point and route-map responses with CORS-enabled simple GETs.
`DukeRealtimeProvider` consumes only those public responses, caches route metadata, and keeps every
TransLoc field/parser inside `campuses/duke`. The endpoints are publicly reachable but undocumented
and have no published compatibility or rate-limit contract, so every failure degrades to the saved
static schedule and official-map fallback rather than becoming fatal.

The UI continues to offer an experimental embed of the official
[Duke TransLoc live map](https://duke.transloc.com/). This is a third-party visual page for viewing
vehicle GPS positions only: the app does not inspect its DOM, inject JavaScript, copy cookies, read
ETA predictions, or send its contents into the routing engine. The saved static GTFS and official
schedule supplement remain the sole inputs to commute recommendations. The external TransLoc link
is always available, and is promoted automatically if the iframe reports an error or takes too long
to load. Browser security prevents a parent page from detecting every possible cross-origin frame
failure, so the external link remains visible even after a nominal iframe load.

As checked on 2026-08-27, the TransLoc page was HTTPS and its main response did not include
`X-Frame-Options` or a CSP `frame-ancestors` restriction. That is not a permanent contract; if the
provider changes its policy, the app will not attempt to bypass it. Android does not add TransLoc to
Capacitor `allowNavigation`, does not enable mixed HTTP content, and does not grant the embedded
frame geolocation permission.

`npm run gtfs:validate` audits the current raw feed and prints every C1 and LL-family variant with
its exact source IDs, trip IDs, frequency windows, and sample first-stop departures. As of the last
verification, the raw feed defines `TL-13 / LLCCW` and `TL-19 / LLCCWN` but supplies no trips for
either route. Duke's official route page does publish complete major-stop times for both variants.

The Duke adapter therefore applies a small bundled supplement only when those raw routes still have
no trips. It preserves `TL-13` and `TL-19`, creates clearly namespaced `duke-official:*` trip and
trip IDs, reuses TransLoc's raw stop IDs, and cites the source in the route picker and recommendation
card. Daytime LLCCW is the published exact 24-minute cycle from 07:12 through 17:36. The complete
current TransLoc stop order is included; un-timed intermediate stops are interpolated between Duke's
published checkpoints and displayed as approximate/low-confidence times. Evening departures are
stored explicitly because the official table has an irregular first gap, but only its published
timed stops are exposed because the current TransLoc night stop order conflicts with that table. This
LLCCW supplement covers weekdays from 2026-08-10 through 2027-05-09 and must be reviewed when Duke
publishes the next schedule; the published Fall 2026 tables that drive the other routes are bounded to
2026-12-31 instead. It does
not infer holiday or special-event exceptions absent from the route page. If TransLoc begins
providing trips for a variant, its raw GTFS data automatically wins and the supplement is skipped.

Building coordinates are a small seed set based on public Duke and OpenStreetMap records, not a
complete campus GIS dataset. Contributions should cite the source and favor entrances over broad
parcel centroids.

## Tests

The suite covers quoted GTFS CSV, recurring ICS events, seven-day window filtering, timezone
conversion, multiple feasible buses, a last bus that misses the deadline, buffer behavior, weekend
calendars, `calendar_dates` additions/removals, after-midnight stop times, no feasible transit,
unknown buildings, selected stop order, and refusal to substitute an unselected route.

It also covers the newer surfaces: TransLoc alert parsing (including a captured non-empty payload),
Parking RSS parsing and its 14-day fallback, route/stop text matching, notification-scope filtering,
refresh duplicate suppression, alert content updates, the home departure list and its normal / may
be late / late classification, resolution of a loop terminus that is also a trip's first stop,
week-plan status selection, Live Trip status labels, and the Settings deep-link scroll offset.

GitHub Actions runs formatting, lint, typecheck, tests, the production web build, Capacitor sync, and
an Android debug APK build.

## Roadmap

- v0.2 Live Trip vehicle positions, route progress, and stale/ambiguous data warnings. _Shipped._
- v0.4 Transit alerts from the TransLoc message feed and the Parking news RSS, with notification
  scope settings, per-route badges, and labelled following departures. _Shipped._
- Next: verified arrivals and explicitly opt-in delay-aware recommendation experiments, optional
  system calendar access, and richer Duke building coverage.
- Later: saved route/stop presets, bike timing, more campus adapters, and accessible commute
  preferences.

The [September 2026 data audit](docs/DUKE-DATA-AUDIT-2026-09-21.md) documents repaired C1, SWS,
PR1, H1/H2 and LNC schedules, remaining source conflicts, and GPS-only map fallback behavior.

## Privacy

Schedules, language, stop bindings, alert scope, and saved Home coordinates remain on the device.
The app sends GTFS and foreground Live Trip requests to Duke's TransLoc host, map-tile requests to
OpenStreetMap, and only user-submitted address searches to OpenStreetMap Nominatim. Foreground alert
refresh also requests Duke's TransLoc message feed and the Duke Parking & Transportation news RSS
(through native HTTP on Android, which is required because that feed does not send CORS headers).
Cached alerts and the notification dedupe state stay on the device. The app has no analytics or
application backend. Do not enter confidential information in the address search.

## License

[MIT](LICENSE)
