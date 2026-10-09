# Changelog

[Português](CHANGELOG.pt-BR.md). Versions follow Semantic Versioning. Dates use YYYY-MM-DD.

## [Unreleased]

## [0.4.2] - 2026-10-09

- Improve month overflow-control contrast and reduce its vertical spacing.
- Adapt visible month cards and minimum day height to each panel's measured width, including year/quarter views; preserve overflow callbacks and explicit unlimited rendering.

## [0.4.1] - 2026-10-09

- Align month-panel and week heights across year/quarter views when event density differs.
- Measure wrapped resource/group titles to keep timeline rows and virtualization geometry aligned, including font changes.
- Use automatic hour-label spacing in the narrow hierarchical timeline example.

## [0.4.0] - 2026-10-09

- Default month/year/quarter panels to six weeks; add `monthFixedWeeks: false` for natural four-to-six-week ranges, including adjacent dates in reported ranges.
- Correct annual-planner sticky scrolling and uniform row heights, compact multi-month cells with closed borders, resource-timeline group dividers and the demo's today contrast.
- Add EN/PT AI integration guides, a `llms.txt` index and readable Markdown API contracts generated from source types; correct persistence examples to use named arguments.

## [0.3.0] - 2026-10-09

- Add grouped partial editor dictionaries with EN/PT fallback, named message formatters, Intl date labels and seven timed recurrence frequencies; prevent intraday all-day rules.

- Refreshed documentation/playground brand colors with theme-aware contrast; bilingual READMEs reuse the site logo and separate language selection from navigation.

- Add nested resource rows and bounded vertical timeline virtualization, preserving offscreen capacity, focused/active rows and print data.
- Add consumer undo/redo with asynchronous persistence and strict ICS import/export with diagnostics.
- Support seven recurrence frequencies and BYWEEKNO/time filters; reject invalid rule combinations, including COUNT with UNTIL (breaking validation change).
- Add explicit reading direction, mirrored slot coordinates and sticky scrolling; expand simulated touch regressions.
- Organize 28 focused examples into a searchable feature directory; add history, ICS, editor translation and hierarchical timeline/RTL demonstrations.
- Contain annual-planner event titles, clarify preparation versus fixed closures, separate sticky resource labels and keep the current-time indicator below the time axis.
- Hide duplicate horizontal scrollbar when the synchronized top control is active.
- Share highlighted, copyable documentation snippets and expand the EN/PT integration comparison.

## [0.2.0] - 2026-10-09

### Added

- Configurable resource columns across dates, grouped resource timelines for day/week/month periods, multi-month/year/quarter panels and an annual planner; views are registered explicitly.
- Printable visible-range agenda and native browser PDF output, independent of the rendered resource window.
- Named-input contracts for core utilities and custom-view navigation; positional overloads and compatibility adapters are removed (breaking change).
- Contract audit and generated EN/PT reference cover controller, editor and custom-view integration types.

- `renderDayHeader` customizes day/resource headers while retaining their default content; day decoration responds to consumer API data.
- Synchronized horizontal scrollbar above overflowing time grids and resource timelines.

### Fixed

- Recurrence uses the existing civil iterator with one injected Temporal implementation; the previous provider is retained only as a development oracle. Month + Day consumer bundles shrink from 146,041 to 70,925 gzip bytes in the pinned comparison.
- Retired duplicate API catalogs and one-time migration tools; archived engineering records retain neutral decisions and scenarios.
- Touch swipes scroll without briefly creating a gesture preview; holding enables intentional moves.
- All-day labels stay aligned with the time axis during combined page and horizontal scrolling.
- Bounded month weeks share a consistent height; narrow overflow labels stay within their cells and today's number uses compact emphasis.
- Day-status demo colors support both themes. Focused examples display their actual configuration and custom-view source.
- Publishing guides contain reusable maintainer instructions rather than conversation or approval history.

## [0.1.1] - 2026-10-08

### Added

- Configurable compact month threshold measured from the calendar container (`monthCompactBreakpoint`, default `false` keeps cards; a width enables it).
- Focused feature demos with integration code and a resizable calendar container; general playground remains available.
- Documentation index separates public guides from archived engineering records.

### Fixed

- Shared documentation/playground navigation, compact language/theme toggles and a working return link.
- Dark editor contrast; preparation buffers are clearly distinguished from fixed closures.
- Outgoing drag retains pointer capture and shows a floating card outside the grid; reentry and cancellation clean up the preview.
- Compact month separates today, the selected date and dot/count event markers, uses shorter cells and preserves normal cards on intermediate widths.

Version 0.1.0 was withdrawn at the maintainer's request during the repository history reset. Install 0.1.1 using its release asset.

## [0.1.0] - 2026-10-08

Initial experimental release under the MIT license.

### Added

- Native React calendar, selectable/custom views, resources and per-resource capacity/constraints.
- Recurrence, exceptions, occurrence/series/following editing, asynchronous persistence callbacks.
- Event drag/resize, previews, overflow popovers and optional external drag/drop.
- Shared editor validation, navigation/loading/error callbacks and abortable remote event sources.
- Responsive layouts, page sticky headers, default theme and bilingual public API documentation.
- GitHub CI and manual draft-release packaging with SHA-256 checksums; MIT license.
- Bilingual searchable API/demo site for GitHub Pages, project review skill and Prettier checks.
- Persistent light/dark/system themes for the documentation site and playground, with English/Portuguese playground and editor labels.
- Live feature scenarios and visible reproducible competitor bundle comparisons; improved custom Summary demonstration.
- Incoming template and outgoing archive demo panels with consumer-controlled persistence.
- Gesture auto-scroll using existing page/container scrolling; disable with `autoScroll: false`.

### Fixed

- Initial date resolution in the configured time zone and date selection in compact month.
- Unnecessary remote refetches when changing inactive views or their order.
- Declarative options reset, resource-rule composition and validation of all assigned resources.
- External drag preview on first entry into an all-day target.
- Sticky date/all-day/time/resource geometry and clearer separators while scrolling.
- External template pointer initiation and outgoing drop target access in the playground.
- Dependency compatibility updates: Temporal fallback 0.5.1, development React 19.3.0 and jsdom 30.1.2.
- Explicit required views remove automatic registration and improve tree shaking.

### Known limits

- React 19/Edge is the tested runtime; physical Safari/mobile and screen-reader validation remains open.
- No automatic persistence, full RFC 5545 coverage, ICS export, resource virtualization or multi-day resource timeline.
- Versioned package assets are immutable; documentation/playground updates can be deployed separately.

