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
