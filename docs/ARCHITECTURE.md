# Architecture

Campus Commute Assistant is a local-first React application packaged for Android with Capacitor.
The core modules contain no Duke-specific branching and can run in Vitest without a browser.

## Boundaries

- `core/calendar`: imports and expands iCalendar events and creates stable course/location keys.
- `core/gtfs`: downloads, parses, validates, and caches a GTFS zip in IndexedDB.
- `core/locations`: normalizes building labels and performs geospatial calculations.
- `core/routing`: matches the latest feasible trip for the user's exact route and stop selection.
- `core/realtime`: vendor-neutral snapshots, request deduplication, polyline projection, directed
  loop progress, and conservative next-vehicle selection.
- `core/notifications`: schedules stable, replaceable local notifications.
- `core/planning`: derives a next-seven-days presentation from imported events and calls the same
  routing engine used by the next-class screen; it does not implement alternate routing rules.
- `core/widgets`: serializes that plan into a small localized Android widget snapshot and invokes a
  narrow native refresh bridge.
- `core/storage`: settings and course persistence via Capacitor Preferences; large GTFS blobs use
  IndexedDB because Preferences is intentionally for small key/value data.
- `campuses/*`: campus metadata, building aliases, data sources, optional official schedule
  supplements, and realtime adapters.
- `components/LiveRouteOverlay` and `components/LiveTripMap`: two presentations of the same derived
  `LiveTripProgress`; neither fetches nor independently selects a vehicle.
- `components/LiveTransitMap`: isolated third-party iframe fallback. It exposes no vehicle or ETA
  data to core modules.
- `i18n.ts`: a small UI/notification dictionary for English and Simplified Chinese. Feed-provided
  route and stop names remain unchanged.

## Offline model

Imported classes, user settings, and the latest successfully parsed GTFS snapshot remain on the
device. A feed refresh is attempted only when requested or when the cache is older than the campus
refresh interval. Refresh failures keep the last good snapshot. No backend is required.

Calendar replacement parses the new `.ics` file before replacing the saved event array. Invalid or
empty input therefore leaves the previous calendar intact. Route, home-stop, and class/building-stop
bindings are stored separately and survive a calendar replacement.

Campus adapters may apply a versioned, bundled supplement after parsing the cached raw feed. A
supplement must use a cited official source, namespace every synthetic ID, and leave the raw archive
unchanged. It should activate only while the corresponding raw route has no trips, so an upstream
GTFS repair automatically takes precedence.

When an official timetable publishes only timing points, a campus supplement may reuse a verified
first-party stop order and interpolate within those anchored segments. Interpolated `StopTime`
records are tagged explicitly; routing lowers their confidence and the UI labels their departure
time as approximate.

## Routing scope in v0.1

The user saves one feed-provided `route_id` and boarding `stop_id` as the home default. Each unique
course/location key stores its own alighting `stop_id`. Routing only evaluates trips on that route
which visit both stops in the selected order. It never searches nearby stops, substitutes another
route, or invents a transfer.

A Home coordinate is optional: without one, the leave time begins at the boarding stop. Known class
buildings add a final walking estimate; unknown calendar locations use the explicitly bound arrival
stop as the destination and never block timetable matching.

The matcher accounts for GTFS service calendars and exceptions, `frequencies.txt`, times beyond
24:00, and a class-arrival buffer. Frequency templates retain their original `trip_id`; exact
headways generate scheduled departures, while inexact headways reserve a full-headway wait and use
low confidence. Feasible departures are ordered by the latest safe leave time.

An optional experimental preference stores building-level arrival stops in a separate map. Known
campus buildings use their stable building ID; unknown locations use the normalized room-free
label, so `Wilkinson 216` and `Wilkinson 123` share a key. Exact course/location bindings are never
rewritten and become active again when the experiment is disabled. This changes only how the UI
looks up the user's selected `destinationStopId`; the routing algorithm receives the same
`TransitSelection` as before.

## Week plan and Android widgets

The week screen filters upcoming classes to the next seven calendar days, then evaluates each event
with the same `getCommuteRecommendations` entry point and the same saved route, stops, walking
settings, buffer, service timezone, and GTFS snapshot as the home screen. Its extra status values
describe missing setup or no matching departure; they do not introduce route search or fallback
routing.

On Android, React serializes the resulting plans to `widget-plans-v1` in the same private
`CapacitorStorage` preferences group used by Capacitor Preferences. Five `AppWidgetProvider`
implementations render different subsets and sizes: next commute, today, today + tomorrow, next
seven days, and a compact one-row-per-day Mini schedule. Providers never parse GTFS and never
reimplement routing. They filter expired entries,
refresh after app-side changes, and request a periodic render no more frequently than Android's
30-minute widget minimum. Opening the app is required to recompute the snapshot after underlying
course, preference, or feed data changes.

The custom Capacitor bridge is deliberately narrow: refresh all widgets, report whether Android
battery optimization applies, and open the standard battery-optimization settings list. The app
does not request direct Doze exemption permission or change device power policy itself.

## Third-party live map

A campus may expose an optional HTTPS `liveMapUrl`. The React UI can display it in an isolated,
near-full-screen iframe with no geolocation permission, script injection, DOM access, credential
storage, or ETA extraction. This feature is deliberately outside `core/realtime`: it is a visual
reference for the user and cannot alter recommendations, confidence, notifications, or GTFS data.

The official-site link is always present. Frame errors replace the iframe with that link, while a
load timeout promotes the fallback and permits a retry. Because same-origin protections make some
cross-origin frame failures impossible to observe reliably, successful `load` is not treated as a
data-integrity signal. Android keeps mixed content disabled and does not add the third-party host to
Capacitor's top-level `allowNavigation` list.

## Live Trip realtime layer

Static schedule selection remains authoritative for route variant, boarding stop, arrival stop,
leave time, confidence, notifications, week plans, and widgets. Realtime is a one-way optional
enhancement:

```text
Duke public rider-map responses -> DukeRealtimeProvider -> RealtimeSnapshotCache
                                                        -> routeProgress
                                                        -> LiveTripProgress
                                                           |-> home overlay
                                                           `-> focused Leaflet map
```

The Duke parser is the only layer that knows TransLoc endpoints and PascalCase response fields. It
maps the numeric provider RouteID through the returned route object's exact `GtfsId`; core modules
receive only GTFS route IDs, decoded coordinates, ordered stops, and normalized vehicle records.
Route metadata is cached for 15 minutes, vehicle snapshots refresh about every 30 seconds while the
document is visible, and concurrent requests are deduplicated.

`routeProgress` projects GPS and ordered stops onto cumulative polyline distance. Closed routes
allow one validated stop-order seam wrap and use directed cyclic distance rather than geographic
or shortest-path distance. Repeated/self-crossing segments require a unique projection or heading
disambiguation. A vehicle older than 90 seconds, off-route, directionally contradictory, or only
reachable through an unconfirmed next lap is not presented as the next bus.

Duke's `duke-llccw` family is a UI/storage compatibility layer, not a feed rewrite. The existing
matcher runs independently with `TL-13` and `TL-19`, and normal service calendars/windows determine
which recommendations exist. Only the Duke adapter owns verified same-platform stop mappings.
Unmapped timing points such as TL-269/TL-270 leave static results untouched and make only realtime
visualization unavailable.

## Adding a campus

Create a folder under `src/campuses`, export a `CampusAdapter` containing configuration and a small
building catalog, then add it to the UI registry. Core parsers and routing must not be changed for a
new campus. A campus-specific `supplementGtfs` hook is optional and should only repair documented
upstream omissions. A realtime provider is optional and static routing remains fully functional
without it.
