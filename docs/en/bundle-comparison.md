# Bundle and integration comparison

Keep one React package. The October 9, 2026 measurement below uses the 0.3.0 source after the feature additions. Removing duplicated recurrence/Temporal code still yields substantially more than splitting view packages. The earlier pre-feature baseline remains preserved separately.

## Measured JavaScript contribution

Node 24.18.1 / Windows, Vite 8.3.3, ES2022, production minification and tree shaking. React, React DOM and CSS are excluded consistently. Totals include every generated JavaScript chunk, gzipped independently; these are not first-render transfers, archive sizes, SSR results, speed rankings or equal feature sets. Build options and selected imports affect the result.

| Scenario                                                | Minified bytes | Gzip bytes |
| ------------------------------------------------------- | -------------: | ---------: |
| Calendara Day                                           |        220,072 |     69,869 |
| Calendara Month + Day                                   |        232,597 |     72,856 |
| Calendara built-in views + resources + editor           |        271,158 |     82,073 |
| FullCalendar Month + Day, React 7.1.1                   |        256,315 |     70,580 |
| Schedule-X Month + Day, calendar 4.9.1 / React 4.1.0    |        235,920 |     68,704 |
| Mantine Month + Day, 9.7.1                              |        276,794 |     85,076 |
| React Big Calendar Month + Day, 1.20.0 / Day.js 1.11.23 |        184,318 |     54,871 |

Before the recurrence change, Calendara Month + Day was **146,041 gzip bytes**. The current **72,856 bytes** retain a reduction of **73,185 bytes (50.1%)** after the added features. The entry falls from 83,195 to **36,447 gzip bytes**. The total includes the lazy Temporal fallback (19,022 bytes), popover (16,763 bytes) and shared labels (624 bytes). Day's entry is 33,465 gzip bytes with a 16,758-byte popover; the built-in views/resources/editor entry is 45,580 bytes, with a 16,769-byte popover plus the same fallback and labels. Native Temporal avoids the fallback download; opening overflow loads the popover when needed. Day excludes MonthView, ListView and the editor. Unimported ICS/history APIs do not contribute to these scenarios.

The earlier recurrence provider embedded a second Temporal implementation. It is now a development-only differential oracle; production uses the civil iterator and one injected/native/fallback namespace. Rules, DST gaps, COUNT, UNTIL, exceptions, overrides and original occurrence identity are covered by integration tests. This change improves transfer size, not a promise of faster expansion in every workload.

[0.3.0 results](../../experiments/bundle-audit/release-0.3-results.json) and the [pinned reproduction recipe](../../experiments/bundle-audit/README.md) preserve versions and per-chunk evidence. The [pre-feature baseline](../../experiments/bundle-audit/current-results.json), [pre-recurrence-change results](../../experiments/bundle-audit/pre-civil-results.json), older [0.1.0 results](../../experiments/bundle-audit/results.json) and [initial view-selection baseline](../../experiments/bundle-audit/baseline.json) are historical. These measurements use the public source entry; release-archive consumption is checked separately by `yarn test:package`.

## Integration tradeoffs

The selected fallback and its capability/performance tradeoffs are documented in [Temporal comparison](temporal-comparison.md).

| Library            | Initial integration                                       | Practical tradeoff                                                                              |
| ------------------ | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Calendara          | JSX, events, required selected views; optional CSS/editor | One installation and explicit persistence; rich date and resource contracts require explanation |
| FullCalendar       | JSX and view/theme plugins                                | Precise capability selection; plugin/theme/license choices add setup                            |
| Schedule-X         | App hook, view factories, wrapper and peers               | Broad extensions; more runtimes and versions to align                                           |
| Mantine            | Views, provider, styles and date dependencies             | Convenient within Mantine; extra setup outside its ecosystem                                    |
| React Big Calendar | JSX, localizer, CSS and container height                  | Familiar API with date-library choice; localization and geometry require setup                  |

These are observable contracts, not a usability study: [FullCalendar React](https://fullcalendar.io/docs/react), [Schedule-X React](https://schedule-x.dev/docs/frameworks/react), [Mantine setup](https://mantine.dev/schedule/getting-started/) and [React Big Calendar](https://github.com/bigcalendar/react-big-calendar#readme).

Calendara's implemented resources, timelines, recurrence, drag/resize, printing, [ICS](ics.md), [history](history.md) and [RTL direction](rtl.md) are MIT. FullCalendar lists resource views, timelines and print-friendly rendering under [Premium](https://fullcalendar.io/docs/premium). Schedule-X distributes extensions through [plugins](https://schedule-x.dev/docs/calendar/plugins); check each license. This does not establish full parity or production maturity. [Extended views](extended-views.md) implements resource hierarchy and automatic vertical virtualization; horizontal virtualization and projection caches remain outside the contract.

## Floating UI and package boundaries

The shared overflow popover is lazy even in Day; its presence does not implicitly register Month. Its **16,763 gzip bytes** are about 23.0% of the current Month + Day total. Positioning, dismissal, focus return and keyboard interaction all belong to that behavior. A smaller positioning-only probe does not provide equivalent interactions. See [Floating UI's separation of positioning and interaction](https://floating-ui.com/docs/react) and the historical [isolated measurements](../../experiments/bundle-audit/floating-results.json).

Native [Popover](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API) and [CSS anchoring](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Anchor_positioning) are candidates after complete focus, overflow, nested-scroll and browser validation. Retain the current lazy implementation until an equivalent alternative is verified.

FullCalendar [issue #7029](https://github.com/fullcalendar/fullcalendar/issues/7029) reported a size increase in a 2022 v6 beta and is closed. It supports measuring consumer bundles, not a claim about current v7 performance or complaint frequency. No verified reviewed complaint specifically demands multiple Calendara-like packages.

Maintain one package and optional views/editor/CSS. Subpaths or route-level lazy loading can improve integration without version-alignment and release overhead. Splitting packages alone would not remove the shared Temporal cost.
