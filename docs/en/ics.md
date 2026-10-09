# iCalendar import and export

The core adapter reads and writes a bounded subset of [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545). It has no additional runtime dependency. Import is atomic: unsupported scheduling semantics throw a `RangeError` rather than returning a partially converted calendar. Persistence, file selection, downloading and conflict resolution remain consumer responsibilities.

```ts
import {
  ensureTemporal,
  importICalendar,
  exportICalendar,
} from '@jacksoncassemiro/calendara/core';

const temporal = await ensureTemporal();
const imported = importICalendar({
  text: await file.text(),
  calendarId: 'personal',
  temporal,
});
// Review diagnostics before saving imported.events.
const exported = exportICalendar({
  events: imported.events,
  temporal,
  timestamp: '2026-10-09T12:00:00Z',
});
// Review exported.diagnostics before downloading exported.text.
```

`UID` becomes the event ID. Import assigns the supplied `calendarId`; export does not encode consumer calendar IDs. Import returns standalone events and recurring masters, with exceptions grouped by UID regardless of component order. It does not merge with existing consumer events.

Supported values are `SUMMARY`, `DESCRIPTION`, date-only all-day intervals, whole-second floating local timestamps, UTC timestamps and local timestamps with an IANA `TZID`. All-day ends remain exclusive; a missing all-day `DTEND` means one day. Timed events require `DTEND` and a positive duration. Both endpoints must use the same value type and zone. No conversion to the browser's local zone occurs.

`RRULE` uses the supported fields of `parseRRule`. `RDATE` and `EXDATE` must match the master's type and zone. A separate `VEVENT` with `RECURRENCE-ID` becomes an override keyed by the unchanged original start. Moved instances retain their identity and duration; `STATUS:CANCELLED` on an instance creates a cancellation override. Export supports occurrence patches for title, description and time, plus cancellation. Other patch fields throw. A timed override key must include the original local time, rather than a date-only fallback key.

`UNTIL` must match the start's DATE/DATE-TIME type. Zoned timed series require UTC `UNTIL`; floating timed series require local `UNTIL`. Floating values have no zone in the event model and follow the consuming calendar's zone at rendering time.

Import accepts unfolded or folded content lines and escaped TEXT values. Export uses CRLF endings and folds lines at 75 UTF-8 octets without splitting a Unicode character. Export requires an explicit UTC timestamp with whole seconds for `DTSTAMP`, making output deterministic. UTC endpoints are written with `Z`.

**Zone interoperability:** IANA names are validated against Temporal's zone database. Export preserves IANA `TZID` but does not embed `VTIMEZONE`; it returns a diagnostic requiring the receiving client to provide its zone database. This output is intended for clients that understand IANA names, rather than fully self-contained RFC timezone definitions. Import rejects every `VTIMEZONE` component, including an embedded definition for an IANA name, to avoid silently replacing supplied rules with different local rules. Custom timezone definitions require another adapter.

Import rejects alarms, attendees, organizers, durations, RDATE periods, scheduling methods, non-Gregorian calendars, custom properties, `RANGE=THISANDFUTURE`, cancelled masters and unsupported statuses/parameters. It also rejects duplicate masters/identities, invalid dates, mismatched recurrence value types and overrides without a recurring master. Input is limited to 5 MiB of UTF-16 code units. This adapter is not a CalDAV client or a meeting invitation processor.

Diagnostics identify omitted import transport fields (`DTSTAMP`, `CREATED`, `LAST-MODIFIED`, `SEQUENCE`) and omitted export consumer fields (`calendarId`, color, editability, resources and opaque metadata). These fields are not round-tripped. Export rejects fractional-second or offset-bearing endpoint values; use the library's local timestamp plus `timeZone` contract. Review every diagnostic before committing imported data or delivering exported data.
