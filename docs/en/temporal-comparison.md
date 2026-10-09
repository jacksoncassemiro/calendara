# Temporal fallback comparison

Calendara selects **temporal-polyfill 1.0.5** as its lazy fallback and uses native Temporal first. `@js-temporal/polyfill` 0.5.1 remains a development-only benchmark reference, never a second production fallback.

## Size and capabilities

| Property | @js-temporal/polyfill 0.5.1 | temporal-polyfill 1.0.5 |
| --- | --- | --- |
| Measured Calendara fallback chunk, gzip | 45,459 bytes | 19,022 bytes |
| ISO dates, times, IANA zones, DST, durations and nanoseconds | Supported | Supported |
| Calendar systems in default entry | Includes non-ISO systems | ISO/Gregorian; other systems require `/full` |
| Native-first package entry | Consumer detects native support | Package also prefers native Temporal |
| Internal integer strategy | JSBI | Native BigInt |
| Library use without changing globals | Supported | Supported; avoid `/global` |
| Additional function entry points | Class API | Class API and tree-shakeable functions |

Calendara currently models ISO dates and uses the class API. The smaller default entry therefore covers its existing contracts; alternate calendar systems are not a new calendar-view capability. The consumer may inject a compatible Temporal namespace. The full package adds calendar-system coverage when required. See [temporal-polyfill entry points](https://github.com/fullcalendar/temporal-polyfill/blob/main/polyfill/README.md#package-entrypoints).

The latter records newer specification updates than the March 2025 baseline described by `@js-temporal/polyfill` 0.5.x. Version numbers alone do not establish quality or abandonment: [reference changelog](https://github.com/js-temporal/temporal-polyfill/blob/main/CHANGELOG.md), [candidate changelog](https://github.com/fullcalendar/temporal-polyfill/blob/main/polyfill/CHANGELOG.md).

## Integrated performance

Node 24.18.1 / Windows, same civil recurrence engine, inputs and complete occurrence outputs; five warmups and 25 samples, alternating provider order. Values are medians in milliseconds.

| Workload | @js-temporal/polyfill | temporal-polyfill |
| --- | ---: | ---: |
| 366 timed occurrences | 35.651 | 30.190 |
| DST gap, COUNT and exclusion | 2.944 | 2.432 |
| DST fold, UTC UNTIL | 0.429 | 0.403 |
| Monthly ordinal and override | 2.628 | 2.301 |
| Distant visible month | 3.421 | 2.736 |
| Leap-year all-day recurrence | 0.445 | 0.506 |

Outputs matched in all six workloads. The candidate wins five medians; some p95 values and the small all-day workload favor the reference. This is not a universal speed ranking or a mobile frame-rate measurement. Size, current ISO contracts and full integration checks favor the candidate overall.

Reproduce: `yarn build && node scripts/compare-temporal.mjs`. [Raw results and p95](../../experiments/temporal-comparison/results.json) preserve the method. All 522 tests and the full browser suite passed with the selected fallback.

`rrule-temporal` is a different category: a recurrence engine that embeds a Temporal implementation. Its isolated expansion benchmark does less composition work than Calendara; it is not evidence that the engine is slower. Calendara replaced it to remove duplicated production code while preserving supported recurrence behavior.
