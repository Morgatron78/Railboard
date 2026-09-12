# Railboard

**Your station. Live.**

Railboard 1.0 is a lightweight, mobile-first UK railway departure and arrival board, designed for iPhone and installable as a progressive web app.

[Open Railboard](https://railboard.morgantech.co.uk)

## Features

- Live departures and arrivals, including expected times, delays, cancellations and platforms.
- Three railway-inspired themes: Retro LED, Modern Rail and Midnight.
- Original SVG dot-matrix lettering on the Retro board.
- Searchable home station and optional favourite destination.
- Tap the station name to search or switch between your three most recent stations.
- Service details with calling points, available predictions, passed-stop indicators and a highlighted favourite-stop summary.
- Follow a train to refresh its calling points every 30 seconds while details are open and visible.
- Open an estimated-position map from live service details when a unique, fresh service match is available.
- Configurable default board, service count, automatic refresh and saved-board caching.
- Automatic refresh every 30 seconds while visible, with stale-data refresh when returning to the app.
- Offline application shell and clearly labelled saved boards when live information is unavailable.
- Preferences stored on your device; no Railboard account or analytics.

## Install on iPhone

Open Railboard in Safari, choose **Share → Add to Home Screen**, and launch it from the new icon. Settings includes the app version and data attribution.

After a deployment, open the app to let it download the update, then close all Railboard windows and reopen it to activate the updated shell.

## Run locally

Requires Node.js 22 or later. The frontend has no package dependencies or build step.

```sh
npm start
npm test
```

Open [the local app](http://localhost:4173/Railboard/). Use this hostname and port for live requests: it is included in the deployed proxy's origin allowlist.

Demo mode uses the same interface with local fixtures:

- `?demo=normal` — sample services and disruption states.
- `?demo=empty` — no services.
- `?demo=error` — unavailable information.

Live mode never substitutes demo services. Demo information must not be used for travel.

## Live data and architecture

The static frontend runs on GitHub Pages. A small Cloudflare Worker forwards requests to the public [railinfo API](https://railinfo.uk/developers), which uses Network Rail and National Rail feeds. The Worker is necessary because the upstream API does not allow direct browser access through CORS.

```text
Railboard PWA → Cloudflare Worker → api.railinfo.uk
```

No rail-data API key is embedded in the app or required by the current provider. Cloudflare deployment requires your own account.

The Worker permits only validated station searches, departure/arrival boards service lookups and the train-position feed. It uses a fixed upstream, does not follow redirects, allows configured browser origins, caches boards and service details for 20 seconds, and station searches for five minutes. Rate-limit responses retain `Retry-After`.

The provider adapter normalises upstream fields before the UI consumes them. Board update times indicate receipt time. Calling points are requested on demand from `/services/lookup` using the station, scheduled time and service date; failures show an unavailable message rather than an invented route. Predictions and other fields are shown only when supplied.

The service worker caches the application shell. Board snapshots are managed separately by the application and labelled as cached when a live refresh has not succeeded. Requests are deduplicated, timed out and subject to a cooldown after rate limiting.

## Project structure

| File | Purpose |
| --- | --- |
| `index.html`, `styles.css` | Shared interface, branding and theme presentation |
| `src/app.js` | Board lifecycle, settings UI and service details |
| `src/provider.js` | Live API adapter, validation and request handling |
| `src/api.js` | Demo fixtures and shared status wording |
| `src/storage.js` | Local preferences and board-cache matching |
| `src/led.js` | Dot-matrix glyphs and SVG renderer |
| `src/config.js` | Public Worker URL |
| `worker/index.js` | Cloudflare proxy |
| `worker/wrangler.toml` | Worker deployment and allowed browser origins |
| `sw.js`, `manifest.webmanifest` | Offline shell and PWA configuration |
| `tests/` | API, storage, proxy, LED and offline-shell checks |

## Deployment

### Frontend

Configure GitHub Pages to publish `main` from the repository root. `CNAME` sets the custom domain. Relative asset paths also support hosting below `/Railboard/`.

When shipping application changes, increment the cache identifier in `sw.js` so installed apps download a new shell. Keep the package version and Settings → About version aligned for releases.

### Cloudflare proxy

From the repository root:

```sh
npx wrangler login
npx wrangler deploy --config worker/wrangler.toml
```

For your own deployment, update `ALLOWED_ORIGINS` in `worker/wrangler.toml` and `API_BASE_URL` in `src/config.js`. Use the Worker HTTPS origin without a trailing slash. Deploy and verify the Worker before publishing a frontend that depends on new proxy routes.

CORS is not authentication: the proxy is public. Monitor usage and respect upstream fair-use limits.

## Verification

Run `npm test` before publishing. The suite covers provider mapping, arrivals, disruption states, station persistence, request deduplication, rate limiting, calling-point lookup, proxy validation, LED symbols and offline-shell assets.

Also check the installed iPhone app after visual changes, especially safe-area rendering, station suggestions, theme switching, service details and recovery after going offline.

Train maps load OpenStreetMap only when requested. Positions are estimates, not GPS. Ambiguous, stale and unsupported overnight matches show an unavailable message; the app does not guess a train from its destination. Following retains previous calling points with a warning if refreshing fails, and stops when the detail sheet closes.
