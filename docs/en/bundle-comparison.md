# Bundle and integration comparison

Measured on 2026-10-08. Keep one React package. The measurements show an opportunity to improve internal tree shaking; they do not justify splitting installation into multiple packages.

## JavaScript contribution

All rows use production Vite 8.3.3, ES2022 and the same React/React DOM exclusion. CSS is excluded. Totals include every generated JavaScript chunk, compressed independently. These are library contribution measurements, not the playground bundle, npm archive sizes, browser speed or equal advanced feature sets.

| Scenario                                             | Version                      | Minified bytes | Gzip bytes | JS chunks |
| ---------------------------------------------------- | ---------------------------- | -------------: | ---------: | --------: |
| Calendara: Day                                       | local 0.1.0                  |        478,823 |    139,609 |         4 |
| Calendara: Month + Day                               | local 0.1.0                  |        490,413 |    142,417 |         4 |
| Calendara: built-ins + resources + timeline + editor | local 0.1.0                  |        520,452 |    149,747 |         4 |
| FullCalendar: Month + Day, Monarch theme             | React 7.1.1                  |        256,315 |     70,580 |         1 |
| Schedule-X: Month + Day, required Temporal           | calendar 4.9.1 / React 4.1.0 |        235,920 |     68,704 |         1 |
| Mantine: Month + Day, provider                       | 9.7.1                        |        276,794 |     85,076 |         1 |
| React Big Calendar: Month + Day, Day.js localizer    | 1.20.0 / Day.js 1.11.23      |        184,318 |     54,871 |         1 |

Calendara's Month + Day consists of a 79,660-byte gzip entry, a 45,459-byte Temporal fallback chunk, a 16,761-byte lazy popover chunk and a 537-byte shared view-label chunk. Native Temporal can avoid downloading its fallback. A closed popover does not need its chunk immediately. Consequently, comparing its total to a competitor's single entry is a worst-case transfer comparison, not a first-render cost ranking.

The audit initially found that Day retained `MonthView`, `ListView` and `defaultViews`: the controller referenced `BUILTIN_VIEWS` as an omitted-views fallback. Day was 145,645 bytes gzip and Month + Day was 145,652, a difference of only 7 bytes. In the run before the final dependency/localization updates, after removing that controller fallback and requiring explicit view definitions, Day excluded those three modules and fell to 142,381 bytes. Month + Day fell to 145,208: selecting Day then saved 2,827 bytes against that configuration. The [baseline](../../experiments/bundle-audit/baseline.json) preserves the original measurements.

The shared popover remains intentionally: Day uses it to expose overflow events. The recurrence implementation also remains without recurring input. Adding built-in views, resources, timeline and the editor increases the final Month + Day gzip total by 7,330 bytes in this fixture. Most of the current cost is shared machinery, not optional view code.

The [recipe and pinned lockfile](../../experiments/bundle-audit/README.md) reproduce the comparison. [Raw results](../../experiments/bundle-audit/results.json) include per-chunk sizes and retained local modules. Calendara uses the public `src/index.ts` entry with production transformation; this experiment does not test installation from a release archive or its generated `dist` entry. Vite compilation validates bundling; it does not validate competitor interactions or accessibility.

The final rerun above includes Calendara's `@js-temporal/polyfill` 0.5.1 fallback and the localization/interaction fixes. Its package development runtime is React/React DOM 19.3.0 with jsdom 30.1.2; React is excluded from this measurement and jsdom is a test-only dependency. The pinned comparator fixture still records React 19.2.0, also excluded. This is not a claim of identical installed development dependencies. Final Day saves 2,808 bytes gzip compared with Month + Day. The earlier figures remain historical evidence of the view-registration fix, not the current bundle totals.

## Integration tradeoffs

| Library            | Initial integration                                                           | Separate capabilities                                                             | Practical tradeoff                                                                                                                  |
| ------------------ | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Calendara          | JSX, event data and required selected view definitions; optional theme import | One package with a `/core` entry; editor can be omitted from JSX                  | Fewer installation decisions; explicit persistence and rich date contracts need explanation; shared recurrence/runtime cost remains |
| FullCalendar 7     | JSX, view/theme plugins and styles                                            | Plugin subpaths within React; Scheduler is a separate premium package             | Precise capability selection; plugin/theme/license choices add setup steps                                                          |
| Schedule-X         | App hook, view factories, React wrapper and styles                            | Services and interactions use plugins; required Preact/signals and Temporal peers | Broad extension points; more versions and runtime dependencies to align                                                             |
| Mantine            | Schedule or standalone views, Mantine provider and styles                     | Separate schedule/dates/core/hooks packages                                       | Convenient in an existing Mantine app; larger setup for an app without Mantine; current peers require React 19.2                    |
| React Big Calendar | JSX, localizer and explicit container height/styles                           | Drag-and-drop addon and selectable localizers                                     | Familiar React API and date-library choice; localization and geometry setup are required                                            |

These setup differences are observable contracts, not a user study proving one API is easier. FullCalendar documents plugin configuration and React 17–19 support in its [React guide](https://fullcalendar.io/docs/react). Schedule-X lists its React hook, required peers and custom components in its [React guide](https://schedule-x.dev/docs/frameworks/react). Mantine documents its dependencies, styles and mandatory Day.js in [getting started](https://mantine.dev/schedule/getting-started/). React Big Calendar documents localizers, CSS and height in its [README](https://github.com/bigcalendar/react-big-calendar#readme).

Calendara's implemented capabilities are MIT, including resources, timeline, recurrence and drag/resize. FullCalendar lists resource views, timelines and printer-friendly rendering under [Premium](https://fullcalendar.io/docs/premium). Schedule-X distributes extensions through [plugins](https://schedule-x.dev/docs/calendar/plugins); check each plugin's current license rather than assuming the core MIT license covers every extension. This is not a claim of complete feature parity or production maturity.

## Complaints and actionable findings

FullCalendar issue [#7029](https://github.com/fullcalendar/fullcalendar/issues/7029) reported a Bundlephobia size increase in a 2022 v6 beta and is closed. It supports checking consumer bundles rather than quoting package size; it does not describe current v7 performance. One report does not establish complaint frequency. No verified complaint specifically demanding multiple Calendara-like packages was found in the reviewed sources.

Recommended priorities:

1. Preserve one installation and compatibility contract. The controller fallback is removed; consider lean subpath entries only if further consumer measurements justify them.
2. Measure optional recurrence loading separately before changing its contract. Keep Temporal fallback available for browsers that need it.
3. Document route-level lazy loading for apps that display the calendar only occasionally. It defers loading; it does not remove total cost.
4. Keep editor, CSS and custom renderers optional. Selected views now eliminate unused view implementations, but should not be advertised as a large bundle-size reduction.

Multiple npm packages would introduce version alignment, release coordination and more installation choices. Subpath exports and shared internal boundaries can provide modularity while preserving the single-package requirement. The audit led to explicit required view definitions; the experiment itself adds no production dependency.

## Floating UI contribution and native alternatives

Remeasured the current source on October 8, 2026 with the same Vite production setup and pinned competitor fixture. The older table above remains a **historical 0.1.0 snapshot**. The updated source contributes:

| Scenario                                                | Minified bytes | Gzip bytes |
| ------------------------------------------------------- | -------------: | ---------: |
| Calendara Day                                           |        491,797 |    143,018 |
| Calendara Month + Day                                   |        504,338 |    146,041 |
| Calendara built-ins + daily resources/timeline + editor |        538,568 |    154,093 |
| FullCalendar Month + Day                                |        256,315 |     70,580 |
| Schedule-X Month + Day                                  |        235,920 |     68,704 |
| Mantine Month + Day                                     |        276,794 |     85,076 |
| React Big Calendar Month + Day                          |        184,318 |     54,871 |

These fixtures do not equalize resource/recurrence/validation functionality. Calendara remains larger in this comparison; splitting packages or removing one dependency does not establish parity. The extra new period/planner views are not selected in these fixtures and are not part of the third row.

Only `MonthMorePopover` imports Floating UI in the library source. It uses positioning with offset/flip/shift/automatic updates, outside/Escape dismissal, role and nonmodal focus management/return. The Month + Day build keeps this in a lazy chunk: **46,568 minified bytes / 16,763 gzip bytes**, about **11.5%** of its total gzip. Its entry is 83,195 gzip bytes and contains no Floating UI modules; Temporal fallback is 45,459 and shared labels 624. These optional chunks are counted in total, not necessarily transferred on first render.

A standalone retained-export probe of the exact Floating UI primitives is 45,893 bytes / 16,476 gzip. The actual isolated Calendara popover is 47,877 / 17,307, with its wrapper/labels included. Positioning-only `@floating-ui/react-dom` is 18,133 / 7,142, but **does not replace focus, role or dismissal**; that is a lower-capability probe, not a drop-in savings promise. [Floating UI explicitly separates positioning from interaction support](https://floating-ui.com/docs/react).

Installed `@floating-ui/react` 0.27.20 occupies 934,317 bytes in `node_modules`; the measured react/react-dom/core/dom/utils directories together occupy 1,457,084 bytes, excluding `tabbable`. Installed directories include declarations and alternate builds. This is not compressed download size or the Calendara `.tgz` size: registry dependencies are installed separately and the consumer bundler selects relevant code.

Native [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API) and [CSS anchor positioning](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Anchor_positioning) can support a smaller implementation. Popover provides top-layer display and native dismissal; anchoring/overflow alternatives are a separate CSS capability. Neither removes application ownership of accessible labels, initial/return focus, controlled state, detached anchors, or custom interactive contents. Check the exact features in the target browser matrix, including older Safari/Firefox; a Baseline label for one API does not cover every anchoring feature.

Recommendation: retain the current lazy implementation until a native prototype passes keyboard, focus-return, multiple calendars, nested scroll/zoom, shadow roots and physical mobile checks. Compare a complete native/fallback implementation before replacing the dependency. A positioning-only hybrid is another candidate, with estimated savings bounded by the measured ~9.3 KB gzip difference between primitive probes, before adding replacement interaction code. Native replacement saves at most the current ~16.8 KB lazy chunk before adding its own implementation. Neither addresses the larger Temporal/shared-core contribution.

Reproduce from the repository root after the pinned fixture install described in `experiments/bundle-audit/README.md`:

```sh
node experiments/bundle-audit/measure-current.mjs
node experiments/bundle-audit/measure-floating.mjs
```

[Current comparator results](../../experiments/bundle-audit/current-results.json) and [Floating UI results](../../experiments/bundle-audit/floating-results.json) preserve byte counts, installed versions and chunk evidence. Scripts write isolated results under Git-ignored `output/floating-audit` and do not modify the release bundle.

## Why the day-only bundle is still large

A separate retained-export probe traces the dependency chain: `Calendar → calendarApp → expandRange → expandEvent → ruleStarts → RRuleTemporal`. `rrule-temporal` 2.2.8 contributes a single module with 232,945 rendered bytes before final minification. Its standalone retained class is **179,616 minified bytes / 49,937 gzip bytes**. These are isolated probe sizes; compressed module sizes cannot be added to estimate an entry's compressed size.

That dependency embeds `temporal-polyfill` and selects native Temporal when present. Calendara also ships its own lazy `@js-temporal/polyfill` fallback (**159,673 minified / 45,459 gzip bytes**). Browsers without native Temporal therefore need two implementations. Native Temporal avoids Calendara's lazy fallback transfer, but the fallback embedded inside the recurrence dependency remains bundled. Passing the dependency's optional Temporal output namespace does not remove its internal implementation. Its [interoperability documentation](https://github.com/ggaabe/rrule-temporal#temporal-implementations-and-interoperability) explains the bundled backend and non-Gregorian processing.

The day-only module map excludes MonthView, ListView and CalendarEventEditor. It includes `TimeGrid → EventOverflow → lazy MonthMorePopover`: day/week timed-event overflow also uses that popover. Its presence is intentional and does not mean the month view is implicitly selected. Renaming this shared component would improve clarity but would not reduce the bundle.

Prioritize one recurrence/Temporal backend before package splitting. Evaluate the existing civil recurrence engine against the full zoned recurrence corpus, including DST gaps, COUNT, exceptions and BY* filters, before replacing the external backend. An upstream native/injected-Temporal entry without an embedded fallback is another option. A lazy recurrence backend can defer the cost, but requires an explicit asynchronous initialization/loading contract; the current synchronous expansion cannot simply await an import. Route-level lazy loading is available immediately. Native popover replacement affects the smaller optional chunk and should follow accessibility validation.

Run `node experiments/bundle-audit/measure-causal.mjs` for chunk/module attribution and the standalone probes. [Causal results](../../experiments/bundle-audit/causal-results.json) preserve the snapshot; rendered module bytes are before final minification.
