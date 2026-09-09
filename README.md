# Railboard

A small, iPhone-first UK railway board PWA. v0.1 uses **simulated data only**.

The requirements are in [Railboard — Codex Project Brief.md](Railboard%20%E2%80%94%20Codex%20Project%20Brief.md).

## Run locally

Requires Node.js 22 or later. No dependencies or build step.

```sh
npm start
npm test
```

Open http://localhost:4173/Railboard/ (also works at `/`). Use localhost rather than opening the HTML file directly so ES modules and service workers work.

## Included in v0.1

- Bromsgrove default, first-run setup, searchable selection of 19 demo stations.
- Retro LED, Modern Rail and Midnight themes.
- Departures/arrivals, 4/6/8/10 services, optional favourite highlighting.
- Service details and calling-point timelines; disruption and replacement-bus examples.
- Validated local preferences; optional last-board cache with explicit stale/offline state.
- Refresh every 30 seconds while visible; manual refresh and reconnect recovery.
- Relative-path PWA manifest, offline shell, PNG installation icons and original train mark.

All routes, times and operators are illustrative, including at alternative stations. A full station catalogue and live data belong to the next phase.

## GitHub Pages

In repository **Settings → Pages**, select **Deploy from a branch**, `main`, `/ (root)` after these files are committed and pushed. No build is required. All application URLs are relative and work below `/Railboard/` or `/railboard/`.

The app uses HTTPS on Pages. On iPhone, open the site in Safari and use **Share → Add to Home Screen**. Visit online once before testing offline. Actual iPhone installation should be verified on a device before release.

The service worker precaches only application assets. Increment `CACHE` in `sw.js` whenever shipping shell changes. An updated worker takes over after existing app tabs close, avoiding mixed application versions. Never put API responses or credentials in the shell cache.

## Structure

- `src/app.js`: UI, settings, refresh lifecycle and journey dialogs.
- `src/api.js`: provider interface and deterministic mock generator.
- `src/storage.js`: defensive persistence and cache matching.
- `styles.css`: shared responsive layout and theme tokens.
- `sw.js`, `manifest.webmanifest`, `icons/`: PWA assets.
- `scripts/serve.js`: local server with project-path support.
- `tests/`: Node tests for providers and persisted settings.

For v0.2, replace `mockProvider` with a Worker-backed provider exposing `getDepartures`, `getArrivals`, `getServiceDetails`, and `searchStations`. Keep National Rail credentials exclusively in Worker secrets. The browser must never receive them.

## Verification

`npm test` covers disruptions, arrival endpoints, station search, empty/error scenarios, corrupt preferences, and cache isolation. For browser checks:

1. Complete onboarding; change themes and station in Settings; reload to verify persistence.
2. Inspect departures, arrivals and a cancelled/delayed service's calling points.
3. Select 10 services to see replacement buses and platform changes.
4. Open `?demo=empty` for an empty board or `?demo=error` for cached/error states.
5. Visit normally online, then disable network and reload to test the offline shell and cached board.
6. Check 320px and 390px widths, keyboard navigation, and an actual iPhone installation.

No live backend or publishing credentials are required for v0.1.
