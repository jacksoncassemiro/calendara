# Recurrence

Calendara expands structured `RRuleModel` values or RRULE strings with all seven RFC 5545 frequencies: `SECONDLY`, `MINUTELY`, `HOURLY`, `DAILY`, `WEEKLY`, `MONTHLY` and `YEARLY`. Intraday frequencies require timed events and are expanded through `expandEvent`.

Supported rule parts are `INTERVAL`, `COUNT`, `UNTIL`, `BYMONTH`, `BYWEEKNO`, `BYYEARDAY`, `BYMONTHDAY`, `BYDAY`, `BYHOUR`, `BYMINUTE`, `BYSECOND`, `BYSETPOS` and `WKST`. Unsupported parts, duplicate parts, invalid integers and invalid combinations throw `RangeError`; structured rules receive the same validation. `COUNT` and `UNTIL` are mutually exclusive.

```ts
const recurrence = {
  rule: 'FREQ=WEEKLY;BYDAY=MO,FR;BYHOUR=9,17;BYMINUTE=0;COUNT=12',
};
```

`BYWEEKNO` supports positive and negative week numbers in yearly rules. `WKST` determines week boundaries; week 1 contains at least four days of the new year. Ordinal `BYDAY` is allowed only with monthly or yearly rules, and never together with `BYWEEKNO`. `BYMONTHDAY` is invalid with weekly rules; `BYYEARDAY` is invalid with daily, weekly or monthly rules. `BYSETPOS` requires another `BY` part and selects from sorted, unique candidates inside one frequency period.

Timed rules preserve local civil time in the series time zone. Nonexistent local times are discarded before `BYSETPOS` and `COUNT`. A repeated local time uses the first occurrence of the fold. Multiple starts on the same date retain their full original date-time identity, duration, exclusions and overrides. For all-day events, time filters are ignored as required for DATE values; intraday frequencies are rejected. The lower-level date expansion APIs do not accept timed rules.

The recurrence set merges RRULE and `rDates`, deduplicates original starts, and applies `exDates` and overrides. Exclusions remove occurrences after the rule's `COUNT` has been consumed. The consumer owns storage and occurrence edits.

Infinite rules require an upper date window. Expansion retains the interval phase when seeking distant windows without `COUNT`; rules with `COUNT` inspect preceding valid starts. Work limits throw instead of returning an incomplete series: timed expansion visits at most 50,000 periods and admits at most 100,000 candidates per period. Narrow the window or time filters if a limit is exceeded.

This is broad RFC recurrence coverage, not a complete iCalendar implementation. Leap seconds (`BYSECOND=60`) are rejected because the injected Temporal implementations do not represent them. Timed rules and `BYWEEKNO`/`BYYEARDAY` use four-digit Gregorian years. Existing all-day rules accept date-time `UNTIL` and timed rules accept date-only `UNTIL` as convenience extensions; strict iCalendar import should enforce DTSTART/UNTIL value types. The core recurrence set represents extra starts, not RDATE PERIOD durations, multiple RRULE properties or VTIMEZONE definitions.

Semantics reference: [RFC 5545 §3.3.10](https://www.rfc-editor.org/rfc/rfc5545#section-3.3.10).
