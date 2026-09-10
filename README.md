# Railboard

A small, iPhone-first UK railway PWA. The current iteration uses the public railinfo.uk API directly; no account, API key, Worker or backend is required.

## Source of truth

- `RAILBOARD-DESIGN-SPEC.md` defines UI and theme direction.
- `RAILBOARD-API-SPEC.md` supersedes the original LDBWS/Cloudflare architecture.
- `Railboard — Codex Project Brief.md` supplies the broader product context.

## Run

Requires Node.js 22 or later. No dependencies or build step.

```sh
npm start
npm test
```

Open http://localhost:4173/Railboard/. Add `?demo=normal` for mock data, `?demo=empty` for the empty state, or `?demo=error` for failure testing. Live mode never substitutes mock services.

## This iteration

- Live departures and arrivals with centrally normalized times, statuses, platforms and operator information.
- Debounced remote station search; station name and CRS saved locally.
- 30-second foreground refresh, in-flight request deduplication, timeout and Retry-After cooldown.
- Per-station/per-board saved data, explicitly labelled cached until refreshed.
- Retro corporate header, blue station strip, original 5×7 SVG LED cells and printed-timetable detail treatment.
- Existing Modern and Midnight layouts retained for subsequent design passes.
- Offline app shell with separate application-managed board snapshots.

## Provider observations

Verified against public responses on 10 September 2026 and https://railinfo.uk/developers:

Both board endpoints currently return a `departures` array; arrival responses use `kind: arrivals`, `public_dep` for the board time and `destination` for the arriving service's origin. These provider conventions are isolated in `src/provider.js`.

The response has no generation timestamp: the app records receipt time. It returns a stop count but no exact calling-point list. Live detail therefore shows available metadata and an explicit unavailable message, never a fabricated timeline. Future journey integration must not imply an unrelated journey plan is the selected train.

## Structure

- `src/api.js`: mock fixtures and shared status text.
- `src/provider.js`: public API adapter, validation, deduplication and cooldown.
- `src/config.js`: public API base URL only.
- `src/storage.js`: preferences and cache matching.
- `src/app.js`: shared board/UI lifecycle.
- `src/led.js`: original glyph definitions and cached SVG renderer.
- `sw.js`: versioned shell cache only; bump its version when shipping assets.

## Deploy

GitHub Pages: deploy `main`, `/ (root)`. Relative asset paths support the project site and the custom domain in `CNAME`. Close existing PWA tabs and reopen after an update to activate the new shell.

## Validation and remaining work

`npm test` covers API field mapping, disruptions, arrivals, missing data, request deduplication, rate limiting, station persistence, LED cells and offline shell assets. Live API reads were verified; a physical iPhone pass remains necessary.

Next: compare Retro visually with the design specification, refine Modern then Midnight, and evaluate truthful detail enhancements as provider data permits. The supplied `App Icon` asset has not been modified.

### Current browser-access blocker

On 10 September 2026, both station search and board responses returned HTTP 200 but omitted `Access-Control-Allow-Origin`, including when requested with `Origin: https://railboard.morgantech.co.uk`. Server-side adapter verification passes, but direct cross-origin browser fetches are blocked until the provider enables CORS. Live mode therefore shows the unavailable state; use `?demo=normal` to preview design. No proxy or secret infrastructure has been introduced. Do not describe this iteration as a working deployed live-data release.

### Cloudflare deployment — 10 September 2026

The user approved a Cloudflare proxy because direct provider CORS is unavailable. The proxy is deployed at https://railboard-proxy.morgan-cope.workers.dev and `src/config.js` now uses it. Departures, arrivals and station search returned HTTP 200 with the site's CORS origin. Earlier direct-access blocker notes above describe the superseded setup. No credentials are used for rail data. See `worker/README.md` for deployment details.
