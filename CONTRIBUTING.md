# Contributing

Thanks for helping students get to class on time. Bug fixes, tests, accessibility improvements,
and carefully sourced campus adapters are welcome.

## Development

1. Install Node.js 20 or newer and run `npm install`.
2. Start the web app with `npm run dev`.
3. Before opening a pull request, run:

   ```bash
   npm run format:check
   npm run lint
   npm run typecheck
   npm test
   npm run build
   ```

Android work additionally requires JDK 21 and Android Studio with Android SDK 35. Run
`npm run android:sync`, then open the `android` directory in Android Studio.

## Changes to routing

Routing changes must include a focused unit test. Preserve service-calendar exceptions,
after-midnight GTFS times, walking on both ends, and the invariants that routing never substitutes
the selected route or stops and recommends the latest matching departure that meets the buffer.

## Campus adapters and data

Do not scrape private endpoints, copy credentials, or commit downloaded GTFS archives. A new campus
adapter must identify the public source and its terms, set the IANA timezone, provide sourced
coordinates for its initial buildings, and function without realtime data. See
`docs/ARCHITECTURE.md` for module boundaries.

## Pull requests

Keep changes small enough to review, explain user-facing behavior, and note any external data-source
assumptions. Never include real student schedules, addresses, location histories, API keys, signing
keystores, or Android `local.properties` files.
