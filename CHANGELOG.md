# Changelog

[Português](CHANGELOG.pt-BR.md). Versions follow Semantic Versioning. Dates use YYYY-MM-DD.

## [Unreleased]

No changes after the prepared 0.1.0 baseline.

## [0.1.0] - 2026-10-08

Initial release candidate; not published yet.

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
- No release has been uploaded; installation URLs become usable after a maintainer publishes the draft.
