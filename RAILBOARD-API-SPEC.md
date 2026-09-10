# Railboard — API & Live Data Implementation Specification

> **Current implementation direction**
>
> This document supersedes the National Rail LDBWS / Cloudflare Worker implementation described in the original `CODEX.md` for the current personal/hobby version of Railboard.
>
> Use `railinfo.uk` directly from the PWA unless or until there is a concrete reason not to.

## 1. Current provider

Base URL:

```text
https://api.railinfo.uk
```

The API is JSON and currently requires no API key.

Relevant endpoints:

```text
GET /stations?q=reading
GET /stations/all
GET /boards/RDG/departures
GET /boards/RDG/arrivals
GET /journeys?from=RDG&to=OXF
```

The board endpoints expose live departure/arrival information including platform, expected time, delay and cancellation status.

Example:

```text
GET https://api.railinfo.uk/boards/BMV/departures?limit=6
```

Railboard's initial default station is:

```text
Bromsgrove (BMV)
```

The API currently publishes a REST fair-use limit of 240 requests/minute per IP. Railboard should operate vastly below this.

---

# 2. Architectural goal

Keep the app simple:

```text
Railboard PWA
GitHub Pages
      |
      v
railinfo.uk REST API
```

Do **not** introduce:

- Cloudflare Workers
- server-side proxies
- secret management
- GitHub Actions data collection
- a database
- a custom backend

unless a future requirement clearly justifies one.

The entire purpose of using railinfo.uk for the hobby version is to avoid unnecessary infrastructure.

---

# 3. Provider abstraction

The frontend must not scatter direct `fetch()` calls to railinfo.uk throughout UI components.

Create a small provider layer.

Suggested public interface:

```js
getDepartures(stationCrs, options)
getArrivals(stationCrs, options)
searchStations(query)
getJourney(fromCrs, toCrs, options)
```

If more detailed per-service information becomes available from the provider, add:

```js
getServiceDetails(serviceId)
```

only when there is a real endpoint/data source to support it.

The rest of Railboard should consume **normalised Railboard objects**, not raw railinfo.uk response structures.

This lets the provider later be replaced by:

- National Rail LDBWS
- another public API
- a Worker-backed provider

without rewriting the app.

---

# 4. Normalised Railboard data model

Exact field mapping should be based on the live provider response, but target a stable application model similar to:

```js
{
  station: {
    crs: "BMV",
    name: "Bromsgrove"
  },
  generatedAt: "2026-09-10T12:34:56Z",
  services: [
    {
      id: "provider-stable-id-if-available",
      scheduledTime: "17:19",
      expectedTime: "17:19",
      destination: "Four Oaks",
      origin: "Bromsgrove",
      platform: "2",
      operator: "West Midlands Railway",

      status: "on-time",
      cancelled: false,
      delayed: false,
      delayMinutes: 0,

      delayReason: null,
      cancellationReason: null,

      raw: {}
    }
  ]
}
```

Do not rely on the `raw` object in UI code. It may be retained temporarily for debugging.

Recommended internal status values:

```text
on-time
delayed
cancelled
scheduled
unknown
```

Status must be derived centrally in the provider adapter rather than independently in each view.

---

# 5. Departure board calls

For departures:

```text
GET /boards/{CRS}/departures
```

Use the station CRS code in uppercase.

Example:

```text
GET /boards/BMV/departures?limit=6
```

The requested limit should align with the user's `Rows to show` preference where practical.

Recommended UI choices:

```text
4
6
8
10
```

If the provider returns fewer services, display what is available.

If it returns more, normalise and trim in the provider layer or pass an appropriate `limit`.

---

# 6. Arrival board calls

For arrivals:

```text
GET /boards/{CRS}/arrivals
```

Use the same normalisation path as departures wherever possible.

Departures and arrivals should share:

- loading logic
- refresh logic
- caching
- error handling
- stale-data handling

Do not create two unrelated implementations.

---

# 7. Station search

Use:

```text
GET /stations?q={query}
```

Station search should support:

- station name
- CRS code

Search behaviour:

- debounce text entry
- approximately 250–400 ms debounce is reasonable
- do not query for every keystroke immediately
- show station name + CRS code
- save both values locally after selection

Do not download `/stations/all` on every app launch.

If a complete local station cache later becomes useful, evaluate it separately.

---

# 8. Journey planning and drill-down

railinfo.uk currently exposes:

```text
GET /journeys?from=RDG&to=OXF
```

with optional:

```text
date
time
direct
```

Use this endpoint where it genuinely supports Railboard's journey/detail UX.

However, do **not** invent per-train calling-point behaviour unless the API actually returns the necessary data.

Important rule:

> The UI specification may be more ambitious than the current provider. Implement the best truthful experience supported by live data, and degrade gracefully where detailed service data is unavailable.

For example:

- If exact calling points are available, show the timeline.
- If only journey-level data is available, show origin, destination, times and status.
- If no stable service-detail endpoint exists, do not fake one with mock data once live mode is enabled.

Mock service-detail data is acceptable in development mode only.

---

# 9. Refresh strategy

Railboard should feel live without hammering the provider.

Recommended behaviour:

1. Fetch immediately when the board opens.
2. Refresh approximately every 30 seconds while the app is visible.
3. Pause periodic refresh when `document.visibilityState !== "visible"`.
4. When returning to foreground:
   - refresh immediately if cached data is stale.
5. Provide manual refresh.
6. Display `Last updated HH:MM`.

Do not poll faster merely because the API limit allows it.

---

# 10. Request deduplication

Avoid duplicate calls caused by:

- component re-render
- theme changes
- rapid tab switching
- settings updates
- multiple listeners

If a request for the same board is already in flight, reuse or suppress the duplicate where practical.

Theme switching must never trigger an unnecessary live-data fetch.

---

# 11. Cache strategy

Cache the last successful board locally.

Simple implementation options:

- `localStorage` for small board snapshots
- IndexedDB if payloads or multiple station caches become larger

Suggested cache key concept:

```text
railboard:board:{CRS}:{departures|arrivals}
```

Store:

```js
{
  fetchedAt: "...",
  data: { ...normalised board... }
}
```

On launch:

- show cached data quickly if available
- mark it as stale/cached until a live fetch succeeds
- update it after a successful request

Do not present cached data as live without a stale indicator.

---

# 12. Stale-data behaviour

Differentiate these states:

## Live

Recent successful response.

Example:

```text
Updated 17:14
```

## Cached/stale

Last successful data is being shown because refresh has not yet succeeded.

Example:

```text
Showing saved data · Updated 17:08
```

## No services

The API call succeeded but returned no relevant trains.

Example:

```text
No departures currently available
```

## API unavailable

The request failed and there is no cached board.

Example:

```text
Live information is temporarily unavailable
```

Retro theme should render these states in its LED style.

---

# 13. Error handling

Handle at minimum:

- network offline
- DNS/network fetch error
- timeout if implemented
- non-2xx response
- malformed JSON
- missing expected fields
- 429 rate limit
- provider unavailable

For `429`:

- honour `Retry-After` if present
- do not enter a rapid retry loop
- continue showing cached data where possible

Log useful technical information to the console in development, but keep user-facing messages simple.

---

# 14. Abort behaviour

When practical, use `AbortController` to cancel obsolete requests, for example:

- user changes station before current request returns
- user switches from departures to arrivals immediately

Do not let stale request results overwrite newer station/view data.

---

# 15. Development and mock mode

Retain a mock provider during UI development.

Suggested conceptual structure:

```text
providers/
  mockProvider.js
  railInfoProvider.js
```

And one selected provider entry point:

```js
const provider = USE_MOCK_DATA
  ? mockProvider
  : railInfoProvider;
```

Do not duplicate UI code for mock/live modes.

Mock mode should contain realistic examples of:

- on time
- delayed
- cancelled
- no platform
- long destination
- no services
- provider error
- calling points if supported by the mock detail UX

---

# 16. Configuration

Keep provider configuration small.

Example:

```js
export const API_BASE_URL = "https://api.railinfo.uk";
export const DEFAULT_STATION = {
  name: "Bromsgrove",
  crs: "BMV"
};
export const REFRESH_INTERVAL_MS = 30000;
```

Do not place mutable user preferences in source configuration.

---

# 17. PWA/offline behaviour

The service worker should cache the application shell.

Do **not** blindly cache live board API responses in a way that makes freshness ambiguous.

Preferred approach:

- service worker caches app assets
- application code manages last-known board cache explicitly
- live API requests should normally go to network
- app can fall back to saved board data if network fails

This keeps stale/live semantics understandable.

---

# 18. Security

railinfo.uk currently requires no API key, so Railboard should contain no rail-data secret.

Do not:

- invent an API key mechanism
- add environment-secret plumbing
- add a proxy just to hide a public endpoint

If the provider later introduces credentials, revisit architecture then.

---

# 19. Privacy

Railboard should not require a user account.

Station preference, theme and favourites should remain local to the device.

Do not add analytics, tracking or remote user profiles unless explicitly requested later.

---

# 20. Fair-use behaviour

The provider currently publishes a REST limit of 240 requests/minute per IP.

Railboard should be far below that.

Target behaviour:

- ~2 board requests/minute while actively visible
- no background hammering
- debounced station search
- no duplicate refresh caused by theme/UI changes

Be considerate even when the limit allows more.

---

# 21. Graceful provider replacement

No UI component should need to know that `railinfo.uk` exists.

Only provider/config files should reference the provider hostname or response shape.

A future replacement should ideally involve:

1. add a new provider adapter
2. map response to Railboard's internal model
3. switch provider selection
4. leave UI unchanged

This is the key reason to preserve the abstraction despite the otherwise simple architecture.

---

# 22. What Codex must not do

Do not:

- build a Cloudflare Worker for the current version
- implement National Rail Basic Auth
- put credentials in GitHub
- schedule GitHub Actions to fetch live boards
- couple components directly to railinfo.uk response JSON
- poll every few seconds
- fake unavailable live fields
- treat an API failure as "no trains"
- erase cached data immediately when a refresh fails
- make theme switching refetch data
- cache API responses indefinitely in the service worker

---

# 23. Implementation order

Recommended order:

1. Inspect existing provider/mock data code.
2. Create/confirm a clean provider interface.
3. Implement station search against railinfo.uk.
4. Implement live departures for Bromsgrove.
5. Normalise provider response.
6. Wire rows-to-show.
7. Add arrivals.
8. Add 30-second visibility-aware refresh.
9. Add last-successful-board cache.
10. Add stale/offline/error states.
11. Evaluate actual journey/detail data exposed by the API.
12. Implement only the drill-down data the provider truthfully supports.
13. Test on GitHub Pages/iPhone PWA.

---

# 24. Immediate instruction to Codex

> Read `CODEX.md`, `RAILBOARD-DESIGN-SPEC.md` and this file before changing the live-data architecture. For the current personal version, use `https://api.railinfo.uk` directly from the client. Keep the provider behind an abstraction and normalise responses into Railboard's internal model. Do not build the previously proposed Cloudflare Worker or National Rail LDBWS integration. Implement live departures first for Bromsgrove (BMV), then arrivals, caching, refresh and truthful journey-detail support.
