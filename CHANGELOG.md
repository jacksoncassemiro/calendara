# Changelog

[Português](CHANGELOG.pt-BR.md). Versions follow Semantic Versioning. Dates use YYYY-MM-DD.

## [Unreleased]

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
