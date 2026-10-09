import { describe, expect, it } from 'vitest';
import ICAL from 'ical.js';
import { Temporal } from 'temporal-polyfill';
import { importICalendar, exportICalendar } from '../../src/core/io/ics.js';
import { expandEvent } from '../../src/core/recurrence/recurrenceSet.js';
import type { CalendarEvent } from '../../src/core/types/index.js';

const timestamp = '2026-10-09T12:00:00Z';
const calendar = (body: string) =>
  `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//test//EN\r\n${body}\r\nEND:VCALENDAR\r\n`;
const read = (text: string) =>
  importICalendar({ text, calendarId: 'personal', temporal: Temporal });

describe('iCalendar adapter', () => {
  it('includes DTSTART in an RDATE-only set and inherits omitted override titles', () => {
    const imported = read(
      calendar(
        [
          'BEGIN:VEVENT',
          'UID:extra',
          'DTSTART;VALUE=DATE:20261009',
          'SUMMARY:Original',
          'RDATE;VALUE=DATE:20261012',
          'END:VEVENT',
          'BEGIN:VEVENT',
          'UID:extra',
          'RECURRENCE-ID;VALUE=DATE:20261012',
          'DTSTART;VALUE=DATE:20261013',
          'END:VEVENT',
        ].join('\r\n'),
      ),
    );
    const occurrences = expandEvent({ temporal: Temporal, event: imported.events[0]! });
    expect(occurrences.map((entry) => entry.originalStart)).toEqual(['2026-10-09', '2026-10-12']);
    expect(occurrences[1]!.event.title).toBe('Original');
    expect(occurrences[1]!.event.time.start.date).toBe('2026-10-13');
  });
  it('preserves exclusive multi-day ends and escapes/folds Unicode text accepted by an independent parser', () => {
    const event: CalendarEvent = {
      id: 'holiday@example.test',
      calendarId: 'personal',
      title: 'Férias 🗓️; São Paulo, '.repeat(12),
      description: 'First line\nSecond \\ line',
      time: { allDay: true, start: { date: '2026-10-10' }, end: { date: '2026-10-14' } },
    };
    const exported = exportICalendar({ events: [event], temporal: Temporal, timestamp });
    expect(
      exported.text.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75),
    ).toBe(true);
    const component = new ICAL.Component(ICAL.parse(exported.text));
    const oracle = new ICAL.Event(component.getFirstSubcomponent('vevent')!);
    expect(oracle.endDate.toString()).toBe('2026-10-14');
    expect(oracle.summary).toBe(event.title);
    expect(read(exported.text).events).toEqual([event]);
    expect(exported.diagnostics.some((entry) => entry.property === 'calendarId')).toBe(true);
  });

  it('imports IANA local starts, EXDATE, RDATE and a moved/cancelled instance preserving original identity', () => {
    const imported = read(
      calendar(
        [
          'BEGIN:VEVENT',
          'UID:series',
          'DTSTART;TZID=America/New_York:20261030T090000',
          'DTEND;TZID=America/New_York:20261030T100000',
          'SUMMARY:Daily',
          'RRULE:FREQ=DAILY;COUNT=5',
          'EXDATE;TZID=America/New_York:20261031T090000',
          'RDATE;TZID=America/New_York:20261105T090000',
          'END:VEVENT',
          'BEGIN:VEVENT',
          'UID:series',
          'RECURRENCE-ID;TZID=America/New_York:20261101T090000',
          'DTSTART;TZID=America/New_York:20261101T140000',
          'DTEND;TZID=America/New_York:20261101T160000',
          'SUMMARY:Moved',
          'END:VEVENT',
          'BEGIN:VEVENT',
          'UID:series',
          'RECURRENCE-ID;TZID=America/New_York:20261102T090000',
          'STATUS:CANCELLED',
          'END:VEVENT',
        ].join('\r\n'),
      ),
    );
    const master = imported.events[0]!;
    const occurrences = expandEvent({
      temporal: Temporal,
      event: master,
      window: { start: '2026-10-30', end: '2026-11-06' },
    });
    expect(occurrences.map((entry) => entry.originalStart)).toEqual([
      '2026-10-30T09:00:00',
      '2026-11-01T09:00:00',
      '2026-11-03T09:00:00',
      '2026-11-05T09:00:00',
    ]);
    expect(occurrences[1]!.event.time.start.dateTime).toBe('2026-11-01T14:00:00');
    expect(occurrences[1]!.event.time.start.timeZone).toBe('America/New_York');
    const exported = exportICalendar({ events: imported.events, temporal: Temporal, timestamp });
    expect(exported.diagnostics.some((entry) => entry.property === 'TZID')).toBe(true);
    expect(read(exported.text).events).toEqual(imported.events);
  });

  it('keeps UTC and floating timestamps distinct and applies the all-day default end', () => {
    const imported = read(
      calendar(
        [
          'BEGIN:VEVENT',
          'UID:utc',
          'DTSTART:20261009T120000Z',
          'DTEND:20261009T130000Z',
          'END:VEVENT',
          'BEGIN:VEVENT',
          'UID:floating',
          'DTSTART:20261009T120000',
          'DTEND:20261009T130000',
          'END:VEVENT',
          'BEGIN:VEVENT',
          'UID:date',
          'DTSTART;VALUE=DATE:20261009',
          'END:VEVENT',
        ].join('\r\n'),
      ),
    );
    expect(imported.events[0]!.time.start.timeZone).toBe('UTC');
    expect(imported.events[1]!.time.start.timeZone).toBeUndefined();
    expect(imported.events[2]!.time.end.date).toBe('2026-10-10');
  });

  it.each([
    ['DURATION:PT1H', 'unsupported event property'],
    ['ATTENDEE:mailto:person@example.test', 'unsupported event property'],
    ['RDATE;VALUE=PERIOD:20261010T090000/20261010T100000', 'unsupported RDATE value'],
    ['RECURRENCE-ID;RANGE=THISANDFUTURE:20261010T090000', 'unsupported RECURRENCE-ID parameter'],
    ['DTSTART:20261010T090000', 'duplicate DTSTART'],
  ])('rejects unrepresentable semantics atomically: %s', (extra, message) => {
    expect(() =>
      read(
        calendar(
          [
            'BEGIN:VEVENT',
            'UID:event',
            'DTSTART:20261009T090000',
            'DTEND:20261009T100000',
            extra,
            'END:VEVENT',
          ].join('\r\n'),
        ),
      ),
    ).toThrow(message);
  });

  it('rejects custom zone components, invalid dates, missing masters and duplicate identities', () => {
    expect(() => read(calendar('BEGIN:VTIMEZONE\r\nTZID:Custom\r\nEND:VTIMEZONE'))).toThrow(
      'unsupported or nested component VTIMEZONE',
    );
    expect(() =>
      read(calendar('BEGIN:VEVENT\r\nUID:bad\r\nDTSTART;VALUE=DATE:20260230\r\nEND:VEVENT')),
    ).toThrow();
    expect(() =>
      read(
        calendar(
          'BEGIN:VEVENT\r\nUID:missing\r\nRECURRENCE-ID;VALUE=DATE:20261009\r\nSTATUS:CANCELLED\r\nEND:VEVENT',
        ),
      ),
    ).toThrow('override without recurring master');
  });

  it('reports ignored transport fields and refuses export precision/partial overrides it cannot preserve', () => {
    const event = read(
      calendar(
        'BEGIN:VEVENT\r\nUID:event\r\nDTSTAMP:20261009T120000Z\r\nDTSTART:20261009T090000\r\nDTEND:20261009T100000\r\nEND:VEVENT',
      ),
    ).events[0]!;
    expect(
      read(
        calendar(
          'BEGIN:VEVENT\r\nUID:event\r\nDTSTAMP:20261009T120000Z\r\nDTSTART;VALUE=DATE:20261009\r\nEND:VEVENT',
        ),
      ).diagnostics,
    ).toHaveLength(1);
    expect(() =>
      exportICalendar({
        events: [
          { ...event, time: { ...event.time, start: { dateTime: '2026-10-09T09:00:00.001' } } },
        ],
        temporal: Temporal,
        timestamp,
      }),
    ).toThrow('whole seconds');
    expect(() =>
      exportICalendar({
        events: [
          {
            ...event,
            recurrence: {
              rule: 'FREQ=DAILY;COUNT=2',
              overrides: { '2026-10-10T09:00:00': { color: 'red' } },
            },
          },
        ],
        temporal: Temporal,
        timestamp,
      }),
    ).toThrow('unsupported override field color');
  });
});
