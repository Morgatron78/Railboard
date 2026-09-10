# Railboard --- Visual Design & Implementation Specification

**Purpose:** Give Codex a concrete, implementation-oriented design
system for Railboard so the built PWA matches the approved visual
direction rather than becoming a generic card-based app.

## 1. Product direction

Railboard is a small, mobile-first UK railway departure-board PWA. It
should answer one question exceptionally quickly:

> **What's happening at my station?**

The app has three deliberately distinct themes:

1.  **Retro LED** --- Railboard's signature British Rail-flavoured
    electronic departure board.
2.  **Modern Rail** --- a clean, contemporary interpretation of classic
    British railway information design.
3.  **Midnight** --- the dark/OLED counterpart to Modern Rail.

All themes must present the same underlying information and navigation,
but they should not merely be colour swaps.

Primary development target: **iPhone portrait**.\
Default development station: **Bromsgrove (BMV)**.

------------------------------------------------------------------------

# 2. Shared design principles

## Information hierarchy

A departure row should make these elements readable in roughly this
order:

1.  Scheduled departure time
2.  Destination
3.  Live status / expected time
4.  Platform
5.  Operator or secondary information, if shown

The user should be able to open Railboard and understand the next useful
train within about two seconds.

## Navigation

Keep navigation extremely small and predictable.

Preferred primary destinations:

-   Departures
-   Arrivals
-   Station / favourites where useful
-   Settings

Avoid hamburger menus, floating action buttons, glass effects, oversized
tab bars, or unnecessary navigation layers.

## Interaction

-   Entire service rows are tappable in Modern Rail and Midnight.
-   Retro LED may also support tapping a row, but must retain the visual
    character of a physical information display.
-   Touch targets must remain comfortably usable on iPhone.
-   Do not require hover interactions.
-   Pull-to-refresh may be added if it behaves naturally, but automatic
    refresh remains primary.

## Status language

Prefer railway-style wording:

-   `On time`
-   `Expected 17:42`
-   `Delayed`
-   `Cancelled`
-   `Platform changed`

Do not overuse coloured badges.

## Shared theme tokens

Use CSS custom properties rather than scattering colours through
components.

Suggested starting tokens:

``` css
:root {
  --br-blue: #003B73;
  --br-red: #D71920;
  --br-off-white: #F2F0E8;
  --rail-ink: #121820;
  --retro-black: #10100E;
  --led-amber: #FFB000;
  --led-off: #302818;

  --status-ok: #16833B;
  --status-warning: #C87500;
  --status-danger: #C9232C;

  --midnight-bg: #090D11;
  --midnight-surface: #121820;
  --midnight-rule: #26303A;
  --midnight-text: #F4F6F8;
  --midnight-muted: #AAB4BE;
}
```

These are design starting points, not claims of canonical historic
British Rail colour values.

------------------------------------------------------------------------

# 3. Typography

## Rail-inspired UI typography

The Modern Rail and Midnight themes should evoke classic British railway
information design through:

-   clean sans-serif forms
-   excellent legibility
-   strong weights for times and station names
-   disciplined alignment
-   restrained use of type sizes

Do **not** bundle a proprietary Rail Alphabet font unless its licensing
explicitly permits this project.

Choose a legally distributable alternative with similar qualities.

## Retro typography

The Retro LED board should not simply use an orange "digital" webfont.

Preferred implementation:

-   custom dot-matrix renderer
-   5×7 minimum
-   7×9 preferred for prominent text
-   visibly separate LED cells
-   faint unlit cells
-   restrained glow

A suitably licensed matrix font may be used only as a fallback if the
custom renderer is impractical.

------------------------------------------------------------------------

# 4. Retro LED theme

## Design intent

The Retro LED theme should feel as if British Rail's late-20th-century
design language had been adapted into an iPhone departure app.

It must **not** look like a contemporary mobile app with black
backgrounds and orange text.

Use three visual layers:

1.  BR-flavoured corporate header
2.  Rail-blue station strip
3.  Physical-looking amber LED departure board

Avoid modern cards inside the board.

------------------------------------------------------------------------

## Header

Background:

`#F2F0E8`

Content:

-   rail/double-arrow-inspired identity mark on left
-   `RAILBOARD` wordmark in Rail Blue
-   small `Your station. Live.` strapline where space allows

The header should feel like printed corporate railway material.

Do not use rounded containers around the logo or wordmark.

Suggested height: approximately 64--72 px including safe-area treatment.

------------------------------------------------------------------------

## Station strip

Directly beneath the corporate header.

Background:

`#003B73`

Text:

white

Example:

`Bromsgrove (BMV)`

Settings action aligned right.

Do not make Settings a floating pill. A simple text action or squared
outlined control is preferable.

------------------------------------------------------------------------

## LED board

Background:

`#10100E`

The board should occupy most of the usable screen.

No cards.

No rounded service containers.

No modern shadows.

A very subtle physical display texture or faint LED grid is desirable.

### Heading

Large:

`DEPARTURES`

Current time aligned right.

Below:

`TIME    DESTINATION             PLT`

Use alignment that remains stable across rows.

### Service example

``` text
17:19   FOUR OAKS                 2
        ON TIME

17:27   HEREFORD                  1
        ON TIME

17:39   LICHFIELD
        TRENT VALLEY              2
        EXPECTED 17:42
```

Long destinations should wrap without destroying the time/platform
columns.

------------------------------------------------------------------------

## LED rendering

Lit cells:

`#FFB000`

Unlit cells:

`#302818`

Requirements:

-   unlit dots remain faintly visible
-   lit dots have a small restrained amber halo
-   do not use a large blurred neon shadow
-   preserve crisp individual LED cells
-   character spacing should feel mechanical and monospaced
-   row alignment matters more than typographic elegance

For performance, cache rendered glyph patterns rather than rebuilding
every dot unnecessarily.

------------------------------------------------------------------------

## Retro statuses

Do not introduce green `On time` pills.

Normal status remains amber.

Delayed:

`EXPECTED 17:42`

Cancelled:

`CANCELLED`

Signal red may be used sparingly for cancellation, provided it still
looks like part of the display.

------------------------------------------------------------------------

## Retro loading

Never use a circular spinner.

Display:

``` text
PLEASE WAIT

UPDATING INFORMATION...
```

The trailing dots may cycle.

------------------------------------------------------------------------

## Retro error state

Display:

``` text
INFORMATION
TEMPORARILY UNAVAILABLE

PLEASE TRY AGAIN
```

Preserve the LED treatment.

------------------------------------------------------------------------

## Retro updates

When a service changes:

-   briefly blank the affected line
-   redraw it
-   optional 80--150 ms flicker

Avoid smooth card slides and fades.

Respect `prefers-reduced-motion`.

------------------------------------------------------------------------

## Retro detail view

Preferred direction: reinterpret a classic printed British Rail
timetable rather than filling the entire detail screen with LEDs.

Use:

-   warm off-white paper-like background
-   Rail Blue headings/rules
-   black/dark text
-   disciplined tabular times
-   clear vertical calling-point list

Example:

``` text
17:27
Bromsgrove → Hereford

────────────────────────

Bromsgrove                 17:27
Droitwich Spa              17:38
Worcester Foregate Street  17:47
Worcester Shrub Hill       17:54
Malvern Link               18:08
Great Malvern              18:13
Hereford                   18:49

────────────────────────

Platform 1             ON TIME
```

This should feel like a railway timetable leaflet, not a modern modal
card.

------------------------------------------------------------------------

# 5. Modern Rail theme

## Design intent

Modern Rail is **not** a generic Bootstrap/iOS list.

It should feel like contemporary railway information design descended
from classic British Rail principles:

-   strong grid
-   restrained palette
-   clear typography
-   excellent alignment
-   minimal ornament
-   immediate scanning

The approved direction uses an off-white background, Rail Blue
structural elements and restrained status colours.

------------------------------------------------------------------------

## Header

Use a strong Rail Blue header or a combination of off-white corporate
header + Rail Blue station bar.

Preferred arrangement:

-   rail-inspired mark
-   `RAILBOARD`
-   station name prominently visible
-   current board context (`Departures`)
-   current/update time kept secondary

Avoid gradients.

Avoid oversized hero areas.

Avoid rounded app-logo containers.

------------------------------------------------------------------------

## Main background

Prefer warm off-white rather than stark browser white:

`#F2F0E8` or a very close accessible variant.

This gives the interface a subtle printed/timetable character.

------------------------------------------------------------------------

## Departures / Arrivals selector

Use a simple segmented treatment.

Keep it compact.

Do not make it the dominant element on the screen.

Selected state may use Rail Blue.

------------------------------------------------------------------------

## Service rows

Rows should be primarily **typographic**, separated by fine rules.

Avoid individual floating cards unless there is a genuine
accessibility/layout need.

Preferred structure:

``` text
17:19   Four Oaks                 [2]   >
        On time

17:27   Hereford                  [1]   >
        On time

17:39   Lichfield Trent Valley    [2]   >
        Expected 17:42
```

Time:

-   large
-   bold
-   fixed-width column

Destination:

-   strong but slightly less dominant than time
-   wraps cleanly

Status:

-   secondary line
-   coloured text where useful
-   no unnecessary pill

Platform:

-   small Rail Blue square/sign
-   white number
-   visually reminiscent of railway platform signage

Chevron:

-   subtle
-   communicates drill-down without competing with data

------------------------------------------------------------------------

## Platform signs

Modern Rail may use small squared platform signs.

Example:

``` text
┌───┐
│ 2 │
└───┘
```

Rail Blue background, white numeral.

Corners should be only slightly rounded, if at all.

Do not turn these into glossy badges.

------------------------------------------------------------------------

## Status colours

On time:

restrained green

Delayed/expected:

amber/orange

Cancelled:

signal red

Colour must supplement text, never replace it.

Examples:

`On time`

`Expected 17:42`

`Cancelled`

------------------------------------------------------------------------

## Bottom information

Show:

-   refresh icon/action if useful
-   `Last updated 17:14`

Keep this visually quiet.

The board content must remain dominant.

------------------------------------------------------------------------

## Modern service detail

This is a major feature.

Use a dedicated page/sheet that feels like railway information, not a
generic ecommerce detail screen.

Header:

-   back control
-   scheduled time
-   destination
-   live status
-   platform sign

Then show useful metadata such as:

-   operator
-   origin
-   destination
-   expected departure
-   delay/cancellation reason when available

### Calling-point timeline

Use a clean vertical timeline.

Each calling point should show:

-   station name
-   scheduled time
-   expected time if different
-   platform where useful

Visually distinguish:

-   already passed
-   current/next relevant point
-   future stops

Do this subtly.

Do not create a large card for every calling point.

Thin rules, dots and typography are preferable.

------------------------------------------------------------------------

# 6. Midnight theme

## Design intent

Midnight is the dark counterpart of Modern Rail, optimised for OLED
iPhones and evening use.

It must retain Modern Rail's grid and hierarchy.

It should **not** become another neon/cyberpunk dark theme.

Characteristics:

-   near-black background
-   slightly raised dark surfaces where necessary
-   white/off-white primary text
-   muted grey secondary text
-   Rail Blue accents
-   restrained green/amber/red live statuses

------------------------------------------------------------------------

## Background and surfaces

Main:

`#090D11`

Optional secondary surface:

`#121820`

Rules:

`#26303A`

Avoid pure black for every surface; subtle tonal separation helps
hierarchy.

Do not overuse cards.

Rows can remain flat with fine separators.

------------------------------------------------------------------------

## Header

Either:

-   dark header with white `RAILBOARD` wordmark and restrained rail
    mark; or
-   Rail Blue station strip over the near-black body

Keep the relationship to Modern Rail obvious.

Midnight should look like the same design system after dark.

------------------------------------------------------------------------

## Service rows

Use the same structural grid as Modern Rail.

Example:

``` text
17:19   Four Oaks                 [2]   >
        On time

17:39   Lichfield Trent Valley    [2]   >
        +3 min
```

Primary text:

off-white

Secondary:

muted grey

Platform:

Rail Blue square

Status:

restrained semantic colour

Avoid glowing text.

------------------------------------------------------------------------

## Midnight service detail

Reuse the Modern Rail detail structure.

Adapt only:

-   background
-   rules
-   text colours
-   status colours
-   platform-sign contrast

Do not create a separate interaction model.

This keeps the implementation maintainable and makes theme switching
predictable.

------------------------------------------------------------------------

# 7. Settings design

Settings should feel intentionally designed but neutral enough to work
regardless of selected theme.

Required sections:

## Station

Searchable station picker.

Display station name and CRS code.

Default during development:

`Bromsgrove (BMV)`

## Theme

Show three **visual miniature previews**:

-   Retro LED
-   Modern Rail
-   Midnight

Do not use only radio buttons/text.

The preview should make the difference immediately obvious.

## Default board

-   Departures
-   Arrivals

## Rows to show

-   4
-   6
-   8
-   10

## Favourite destination

Optional station picker.

## Auto refresh

Default enabled.

## Cache last board

Default enabled.

Use native-feeling controls where appropriate, but keep the overall page
visually consistent with Railboard.

------------------------------------------------------------------------

# 8. First-run setup

Keep onboarding to one short screen.

Suggested structure:

``` text
RAILBOARD
Your station. Live.

Choose your station
[Bromsgrove (BMV)          >]

Choose your style

[ RETRO ] [ MODERN ] [ MIDNIGHT ]

[ START ]
```

Theme choices should be visual previews.

After setup, go directly to the departure board.

Never show onboarding again unless settings are reset.

------------------------------------------------------------------------

# 9. Responsive behaviour

Primary target:

iPhone portrait.

Also support:

-   smaller iPhones
-   larger iPhones
-   Android portrait
-   iPad/tablet
-   desktop browser

Rules:

-   preserve readable type sizes
-   allow destination wrapping
-   keep time/platform columns stable
-   use safe-area insets
-   avoid horizontal scrolling
-   do not simply scale the whole UI down
-   desktop may constrain the app to a sensible board width rather than
    stretching rows across the entire monitor

------------------------------------------------------------------------

# 10. Accessibility

All themes must remain genuinely usable.

Requirements:

-   semantic HTML
-   keyboard navigation on desktop
-   useful focus states
-   accessible names for icon-only controls
-   status not conveyed by colour alone
-   sufficient contrast
-   comfortable touch targets
-   `prefers-reduced-motion` support
-   screen-reader-friendly service descriptions
-   LED effects must not compromise legibility

Retro authenticity never overrides accessibility.

------------------------------------------------------------------------

# 11. Implementation architecture

Keep theme presentation separate from data.

Suggested conceptual structure:

``` text
data/provider
      ↓
normalised Railboard service model
      ↓
shared board logic
      ↓
theme presentation
   ├── retro
   ├── modern
   └── midnight
```

Modern Rail and Midnight should reuse substantial markup/component
structure.

Retro may require its own renderer because of the LED matrix.

Do not duplicate API/data logic per theme.

------------------------------------------------------------------------

# 12. Live-data implementation

For the current personal/hobby version of Railboard, use the public
`railinfo.uk` JSON API directly from the PWA where practical.

Do **not** introduce a Cloudflare Worker merely for architectural
purity.

Keep the live-data provider isolated behind the Railboard API
abstraction so it can later be replaced by National Rail LDBWS, a
Worker-backed provider, or another source without rewriting the UI.

Suggested client-level API:

``` js
getDepartures(station, options)
getArrivals(station, options)
getServiceDetails(serviceId)
searchStations(query)
```

The UI should consume normalised Railboard objects rather than raw
provider responses.

------------------------------------------------------------------------

# 13. Refresh behaviour

Suggested:

-   fetch immediately on open
-   refresh approximately every 30 seconds while visible
-   stop/reduce refresh while backgrounded
-   refresh when returning to foreground if stale
-   manual refresh available
-   always show last-updated time
-   retain last successful board for temporary failures

Do not poll aggressively.

------------------------------------------------------------------------

# 14. States Codex must design and test

Every theme must handle:

-   loading
-   on-time train
-   delayed train
-   cancelled train
-   no platform
-   platform change
-   long destination
-   midnight rollover / next-day service
-   no departures
-   API unavailable
-   cached/stale data
-   many calling points
-   missing expected time

Use realistic mock data when necessary.

------------------------------------------------------------------------

# 15. What Codex must avoid

Do not:

-   convert Railboard into a generic card-heavy dashboard
-   introduce Bootstrap-style components
-   add gradients everywhere
-   add glassmorphism
-   add floating action buttons
-   make every status a pill
-   over-round every rectangle
-   use excessive shadows
-   use emoji as primary UI icons
-   make Retro merely an orange dark theme
-   make Midnight neon/cyberpunk
-   introduce a large framework without a clear benefit
-   couple the UI directly to a single rail-data provider
-   sacrifice information density for decorative whitespace

------------------------------------------------------------------------

# 16. Visual acceptance criteria

## Retro LED

Successful when:

-   immediately reads as an old British railway electronic board
-   actual dot cells are visible
-   unlit dots are subtly present
-   BR-flavoured header/station strip feels integrated
-   there are no modern service cards
-   loading/error states remain in character

## Modern Rail

Successful when:

-   looks like a contemporary descendant of British railway information
    design
-   grid/alignment is exceptionally clean
-   off-white + Rail Blue identity is obvious
-   platform signs feel railway-specific
-   service rows are primarily typographic rather than card-based
-   drill-down is polished and useful

## Midnight

Successful when:

-   clearly belongs to the same family as Modern Rail
-   is comfortable on an OLED display at night
-   retains excellent hierarchy
-   does not look neon or game-like
-   semantic status colours remain restrained

------------------------------------------------------------------------

# 17. Recommended Codex workflow

Do not attempt to redesign all three themes simultaneously.

Implement in this order:

1.  **Retro LED board**
2.  Compare visually against the approved mockup/spec
3.  Fix spacing, typography, LED rendering and hierarchy
4.  **Modern Rail**
5.  Implement journey-detail timeline
6.  **Midnight** by adapting Modern Rail's shared structure
7.  Settings/theme previews
8.  Loading/error/empty states
9.  Responsive and accessibility pass

When asked to improve the design, make targeted changes against this
specification rather than inventing a new design direction.

------------------------------------------------------------------------

# 18. Immediate instruction to Codex

> Read this specification before modifying Railboard's visual layer.
> Inspect the existing repository first. Preserve working data and PWA
> functionality. Implement the design progressively, beginning with
> Retro LED. Do not redesign the product into a generic modern mobile
> app. Match the specified British Rail-flavoured visual language,
> information hierarchy, and theme distinctions as closely as practical
> using maintainable HTML, CSS and JavaScript.
