// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { buildCalendarPrintDocument } from '../../src/react/printing.js';
import type { CalendarEvent, TemporalLike } from '../../src/core/index.js';

const temporal = Temporal as unknown as TemporalLike;
const timed: CalendarEvent = {
  id: 'event',
  calendarId: 'calendar',
  title: '<script>alert(1)</script>',
  resourceIds: ['room'],
  time: {
    allDay: false,
    start: { dateTime: '2026-10-07T23:00', timeZone: 'America/Sao_Paulo' },
    end: { dateTime: '2026-10-08T02:00', timeZone: 'America/Sao_Paulo' },
  },
};
const input = {
  temporal,
  events: [timed],
  resources: [{ id: 'room', title: 'Room <B>' }],
  startISO: '2026-10-08',
  endISO: '2026-10-09',
  locale: 'en-US',
  timeZone: 'UTC',
  title: 'Agenda',
};

describe('print snapshot', () => {
  it('projects time zones, includes full intervals and escapes consumer data', () => {
    const html = buildCalendarPrintDocument(input);
    expect(html).toContain('2026-10-08 02:00 – 2026-10-08 05:00');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('Room &lt;B&gt;');
    expect(html).toContain('No events.');
  });
  it('expands recurring events and excludes the all-day end date', () => {
    const event: CalendarEvent = {
      ...timed,
      title: 'Holiday',
      recurrence: { rule: 'FREQ=DAILY;COUNT=2' },
      time: { allDay: true, start: { date: '2026-10-08' }, end: { date: '2026-10-09' } },
    };
    const html = buildCalendarPrintDocument({
      ...input,
      events: [event],
      endISO: '2026-10-10',
      options: { title: 'Print <title>', orientation: 'landscape' },
    });
    const page = new DOMParser().parseFromString(html, 'text/html');
    expect(page.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(page.querySelectorAll('section')[2]?.textContent).toContain('No events.');
    expect(html).toContain('size:A4 landscape');
    expect(page.title).toBe('Print <title>');
  });
});
