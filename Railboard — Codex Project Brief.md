# Railboard

## Project overview

Railboard is a small, polished UK railway departure-board PWA.

The primary use case is extremely simple:

> Open Railboard on an iPhone and immediately see useful live departures from your chosen local station.

The application should feel much more focused and attractive than a general-purpose journey planner.

Initial development is targeted at **Bromsgrove (BMV)**, but users must be able to choose any supported National Rail station in Settings.

Repository:

`Morgatron78/Railboard`

Primary hosting:

**GitHub Pages**

Railboard should therefore remain a static client-side application wherever practical.

---

# Product philosophy

Railboard should be:

- Fast
- Small
- Mobile-first
- Particularly polished on iPhone
- Installable as a PWA
- Immediately useful when opened
- Visually distinctive
- Free of unnecessary accounts/login
- Easy to maintain
- Suitable for static hosting on GitHub Pages

Avoid turning Railboard into a full journey-planning application.

Its purpose is primarily:

**“What's happening at my station?”**

---

# Core experience

Opening the application should immediately display the departure board for the user's saved station.

Example:

Bromsgrove

17:19  Four Oaks              On time   P2  
17:27  Hereford               On time   P1  
17:39  Lichfield Trent Valley +3 min    P2  
17:49  Four Oaks              On time   P2

Updated 17:14

The interface should prioritise:

1. Departure time
2. Destination
3. Expected status
4. Platform

Less important information should have lower visual prominence.

---

# Themes

Railboard has three principal themes.

## 1. Retro LED

This is Railboard's signature theme.

Inspired by traditional British railway electronic departure boards:

- Near-black background
- Amber/orange dot-matrix display
- Authentic dot-matrix appearance
- High contrast
- Minimal interface chrome
- Optional subtle LED glow
- Potential subtle board-update animation

Where practical, text should genuinely resemble a matrix of illuminated dots rather than merely using an orange conventional font.

This theme can intentionally be simpler than the modern interfaces.

The overall effect should feel nostalgic without becoming a parody.

---

## 2. Modern Rail

A clean contemporary British railway interface.

Characteristics:

- Light background
- Excellent typography
- Strong information hierarchy
- Clear status indicators
- Generous spacing
- Easily readable at a glance
- Inspired by good transport information design without directly copying National Rail

The typography can take inspiration from classic British Rail visual design and Rail Alphabet.

Do not assume that a commercial/proprietary Rail Alphabet font can legally be bundled.

Use a legally distributable alternative unless suitable font licensing is confirmed.

---

## 3. Midnight

A premium dark interpretation of Modern Rail.

Characteristics:

- Near-black / charcoal background
- Crisp typography
- Restrained accent colours
- Excellent OLED appearance
- Modern rather than retro
- Particularly attractive as an installed iPhone PWA

Modern Rail and Midnight should share most layout/components.

---

# Settings

Settings should remain deliberately simple.

Required settings:

## Home station

Searchable station picker.

Store both:

- station name
- CRS code

Default during development:

Bromsgrove — `BMV`

## Preferred theme

Choices:

- Retro LED
- Modern Rail
- Midnight

Theme selection should ideally include miniature previews rather than just text/radio buttons.

## Default board

- Departures
- Arrivals

Default: Departures.

## Number of services

Suggested choices:

- 4
- 6
- 8
- 10

## Favourite destination

Optional.

Example:

Birmingham New Street

This may later support filtering/highlighting and fastest-departure functionality.

## Auto refresh

Default enabled.

Live refresh should occur only while appropriate/visible.

## Cache last board

Default enabled.

The most recent successful board should remain visible during brief network/API failures.

---

# First-run experience

On first launch, show a lightweight onboarding screen rather than the full Settings page.

Concept:

Welcome to Railboard

Choose your station  
[Bromsgrove]

Choose your style  
[Retro] [Modern] [Midnight]

[Start]

After this, opening Railboard should go directly to the board.

Do not repeatedly show onboarding.

---

# Journey detail

Services in Modern Rail and Midnight should be tappable.

Opening a service should display detailed journey information.

Important fields include:

- Scheduled departure
- Expected departure
- Platform
- Origin
- Destination
- Operator
- Current status
- Delay
- Cancellation
- Cancellation reason where available
- Delay reason where available
- Calling points

Calling points should preferably be displayed as a clean vertical timeline.

Example:

17:27 Bromsgrove  
      Platform 1

17:38 Droitwich Spa

17:47 Worcester Foregate Street

17:54 Worcester Shrub Hill

18:08 Malvern Link

18:13 Great Malvern

18:49 Hereford

Where available, distinguish scheduled and expected times.

Past/current/future calling points may eventually be represented visually.

---

# Retro journey detail

The Retro LED overview should deliberately remain simple.

When a train is selected, either:

1. show calling points in a retro departure-board style; or
2. transition into the standard journey-detail UI.

Prefer option 1 if it can be implemented elegantly without creating excessive complexity.

---

# PWA requirements

Railboard must be a proper installable PWA.

Required:

- Web app manifest
- Service worker
- Appropriate icons
- Standalone display mode
- iPhone-safe viewport handling
- Correct safe-area handling
- Offline application shell
- Cached last successful board
- Correct behaviour when hosted below `/Railboard/` on GitHub Pages

Avoid hard-coded root `/` paths that break project-site deployment.

---

# Branding

Application name:

**Railboard**

Possible strapline:

**Your station. Live.**

The visual identity is based around classic British railway design.

An app icon based on/inspired by the classic British Rail double-arrow symbol has been discussed and visually mocked up.

Before publishing/distributing branded assets, verify the relevant trademark/licensing position.

During development a placeholder or clearly original rail-inspired mark is acceptable.

---

# Native iOS widget

A genuine WidgetKit iPhone widget was considered.

It is **not currently part of the project**, because the owner does not currently have a paid Apple Developer Program membership.

Do not make native iOS development a prerequisite for Railboard.

The installed PWA should provide an excellent iPhone experience on its own.

A WidgetKit companion could be added in the future.

---

# Data source

Railboard will use National Rail's Live Departure Boards Web Service (LDBWS), backed by Darwin.

Documentation:

`https://realtime.nationalrail.co.uk/LDBWS/docs/documentation.html`

Relevant functionality includes:

- Departure boards
- Arrival boards
- Detailed departure boards
- Calling points/service details
- Fastest departures

Use the current supported API rather than legacy assumptions.

---

# Security architecture

National Rail credentials MUST NOT be included in browser JavaScript or committed to the GitHub repository.

GitHub Actions secrets do not solve this for runtime browser requests because any credential injected into deployed JavaScript becomes visible to users.

Therefore the intended architecture is:

Railboard PWA  
(GitHub Pages)

↓

Railboard API  
(Cloudflare Worker)

↓

National Rail LDBWS / Darwin

The Cloudflare Worker stores National Rail credentials as secrets and makes authenticated upstream requests.

The PWA never receives those credentials.

---

# Cloudflare Worker

Keep the Worker intentionally small.

Its responsibilities should include:

1. Receive a Railboard request.
2. Validate station CRS and parameters.
3. Call National Rail using securely stored credentials.
4. Return clean JSON.
5. Add appropriate CORS headers.
6. Handle upstream errors gracefully.
7. Optionally cache identical requests briefly.

Suggested cache duration:

approximately 15–30 seconds.

Do not build a database/backend platform unless a genuine requirement appears.

---

# API abstraction

The frontend should NOT be tightly coupled to the raw National Rail response.

Use a provider/API abstraction.

For example:

`api.js`

should expose application-level concepts such as:

- `getDepartures()`
- `getArrivals()`
- `getServiceDetails()`
- `searchStations()`

This makes it possible to switch between:

- mock data
- live Worker API

without rewriting UI components.

---

# Development phases

## v0.1 — UI/PWA

Build against realistic mock data.

Deliver:

- Application shell
- Bromsgrove default station
- Retro LED theme
- Modern Rail theme
- Midnight theme
- Settings
- Local persistence
- First-run setup
- Mock departures
- On-time services
- Delayed services
- Cancelled services
- Platform information
- Journey drill-down
- Mock calling points
- PWA manifest
- Service worker
- GitHub Pages compatibility
- Responsive iPhone-first layout

The application should already feel usable at this point.

---

## v0.2 — Live data

Introduce:

- Cloudflare Worker
- National Rail authentication
- Live departure board
- Live arrival board
- Service details
- Calling points
- Error handling
- Short API caching
- Last-known-board caching

Replace the mock provider without major UI changes.

---

## v0.3 — Polish

Potential features:

- Favourite destination
- Destination filtering
- Fastest departures
- Better delay presentation
- Platform-change highlighting
- Update animations
- Improved offline state
- Better station search
- Theme transition polish
- Accessibility review
- Performance optimisation

---

# Data states to design for

The UI must handle more than happy-path on-time trains.

Ensure mock/test data covers:

- On time
- Delayed
- Cancelled
- No platform assigned
- Platform changed
- Unknown expected time
- Bus replacement
- Service with many calling points
- Long station/destination names
- No departures
- API unavailable
- Cached/stale board
- Initial loading

Do not allow long destination names to destroy the mobile layout.

---

# Local persistence

There is no user account.

Store user preferences locally.

Suitable technologies:

- `localStorage` for simple settings
- IndexedDB if richer cached data becomes useful

Avoid unnecessary complexity.

---

# Refresh behaviour

The board should feel live without abusing the upstream service.

Possible initial behaviour:

- Fetch immediately when opened.
- Refresh approximately every 30 seconds while visible.
- Pause/reduce refreshing while backgrounded.
- Refresh immediately when returning to the foreground if data is stale.
- Allow manual refresh.
- Display the last-updated time.

The Worker may additionally cache equivalent upstream calls for approximately 15–30 seconds.

---

# GitHub Pages

GitHub Pages is the preferred and intended frontend host.

Repository:

`Morgatron78/Railboard`

Deployment should remain straightforward.

Do not introduce a framework/build system merely because one is fashionable.

If plain HTML/CSS/JavaScript provides the best small maintainable application, use it.

If a framework is introduced, there should be a clear practical reason.

Keep GitHub Pages deployment simple.

---

# Accessibility

Railboard should be highly legible.

Important requirements:

- Good contrast
- Status must not rely solely on colour
- Appropriate touch targets
- Semantic HTML
- Screen-reader-friendly service information
- Respect `prefers-reduced-motion`
- Avoid excessive LED glow/animation
- Responsive text/layout

The Retro theme must remain genuinely usable rather than sacrificing readability for authenticity.

---

# Design principle

Railboard is not intended to compete with full National Rail journey planning.

The design question to keep returning to is:

> If I'm leaving the house and want to know what's happening at my station, can Railboard give me the answer in two seconds?

If a feature makes that experience slower or more complicated without adding meaningful value, leave it out.

---

# Current priority

Continue development of **v0.1**.

First inspect the current repository contents.

Then:

1. Ensure the project runs correctly from GitHub Pages.
2. Establish a clean application structure.
3. Implement/refine the three themes.
4. Implement settings and persistence.
5. Implement realistic mock departure data.
6. Implement service drill-down.
7. Ensure PWA installation/offline shell works.
8. Test mobile/iPhone layouts.
9. Keep the code ready for the v0.2 Cloudflare Worker integration.

Do not begin by rewriting the project into a large framework.

Preserve the lightweight character of Railboard.