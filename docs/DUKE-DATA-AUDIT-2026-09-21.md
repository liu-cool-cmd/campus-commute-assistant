# Duke timetable and live-map audit — 2026-09-21

The current public GTFS was downloaded from
https://duke.transloc.com/Secure/Admin/Reports/GTFSDownload.aspx.
Raw captures are ignored under `research/transloc/samples/`; no vehicle history is committed.

## Schedule findings and repair

| Raw route            | Finding                                                                                             | Derived app schedule                                            |
| -------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| TL-3 / C1            | Relative template plus inexact 171/343/514-second headways; not the published individual departures | 259 weekday and 102 weekend published trips                     |
| TL-6 / SWS           | Relative midnight templates, no frequency rows                                                      | 113 weekday and 52 weekend trips                                |
| TL-21 / PR1          | Relative midnight template, no frequency rows                                                       | 25 weekday trips                                                |
| TL-2 / H2            | Relative midnight templates, no frequency rows                                                      | 114 weekday trips                                               |
| TL-5 / H1            | Relative midnight templates, no frequency rows                                                      | 135 weekday trips; unmapped outbound H Lot timing point omitted |
| TL-9 / LNC           | Relative midnight templates, no frequency rows                                                      | 24 daytime trips daily, using verified timing points            |
| TL-16 / LNCN         | Relative midnight templates, no frequency rows                                                      | 9 weekday evening trips; first 3 on weekends, ending 18:55      |
| TL-13 / TL-19        | No raw trips                                                                                        | Existing LLCCW official supplement retained                     |
| TL-4 / TL-17 / TL-10 | Relative midnight templates without a usable departure schedule or verified matching official table | Excluded from recommendations; no invented departures           |

Sources: [C1](https://parking.duke.edu/buses-vans/c1-east-west/),
[SWS](https://parking.duke.edu/buses-vans/sws-swift-avenue-shuttle/),
[PR1](https://parking.duke.edu/buses-vans/pr1-bassett-research/),
[H1](https://parking.duke.edu/buses-vans/h1-remote-health-system-lots/),
[H2](https://parking.duke.edu/buses-vans/h2-hospital-loop/),
[LNC](https://parking.duke.edu/buses-vans/lnc-lancaster-commons/),
[LLCCW](https://parking.duke.edu/buses-vans/ll-lasalle-loop-counter-clockwise/).

`publishedTimetables.json` contains only timetable facts, not page HTML. The offline maintainer
script `scripts/import-duke-timetables.ts` extracts all rows, preserves skipped cells, strips footnote
asterisks, and converts post-midnight times to 24:xx. It emits JSON to stdout for review. The source
HTML belongs in ignored samples, with filenames matching the script. It is not fetched at app startup.

The new data is deliberately bounded to 2026-08-10 through 2026-12-31 pending a new semester review;
the end date is an application review boundary, not an official declaration of service through holidays.
Holiday/football changes require a future verified exception source. The official tables themselves
have inconsistencies: C1 weekend stop-number cells disagree with their direction-specific headings;
the reviewed mapping follows the named C1 timing-point columns. LNC timetable topology differs from
the rider-map topology (including reversed North/South labels in parts of the map). Its unverified
columns are omitted, and no intermediate times are interpolated for LNC. H1's outbound H Lot column
has no verified matching ID and is omitted.

Only the observed relative-template export is replaced in the derived feed. The cached ZIP remains
unchanged; raw route IDs remain unchanged; synthetic trips have a `duke-published:` prefix. Absolute
upstream scheduled trips take precedence. Published arrival/departure pairs retain dwell time.
Intermediate C1/SWS/PR1/H1/H2 stops are interpolated between adjacent mapped anchors using the raw
template offsets and are explicitly approximate. Blank or unmapped timing points break interpolation.
The routing engine, ETA policy and notification calculation are unchanged.

## Live-map findings and repair

Heading comparison previously counted adjacent polyline segments on the same branch as separate
competing projections. This incorrectly rejected the current PR1 vehicle and two C1 vehicles in the
captured sample. Projection hypotheses are now compared by distinct along-route positions, including
cyclic separation at the seam. The existing ambiguity, direction and 90-second age checks remain.

The map previously required `status === live` and the home button was disabled otherwise. That hid
valid GPS whenever the next-bus computation could not confirm a seam crossing or a selected stop.
Now route geometry, matched boarding/alighting stops, and fresh on-route vehicles from the exact
selected route remain viewable. They are not labeled as the next bus and no distance is invented.
Reliable results still show only the selected next vehicle and its computed paths. Stale vehicles are
not rendered as live. There is still no ETA integration or route-name matching.

Local audit: `npx vite-node scripts/audit-duke.ts` uses the ignored `gtfs-current.zip`,
`routes-current.json`, and `vehicles-current.json` captures. GPS age is rebased to the captured
`Seconds` value for reproducible projection analysis, not treated as a live observation at test time.
