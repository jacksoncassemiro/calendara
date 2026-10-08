// @vitest-environment jsdom
import { monthView } from '../../src/react/views/MonthView.js';
import { describe, expect, it, vi } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { CalendarApp } from '../../src/react/app/calendarApp.js';
import type { CalendarEvent } from '../../src/core/index.js';
describe('month availability follows global constraints in the displayed hours', () => {
  it('marks weekends and fully blocked days, keeps partial days and existing events accessible', async () => {
    const onEventClick = vi.fn();
    const event: CalendarEvent = {
      id: 'existing',
      calendarId: 'c',
      title: 'Consulta já reservada',
      resourceIds: ['room'],
      time: {
        allDay: false,
        start: { dateTime: '2026-07-24T09:00', timeZone: 'UTC' },
        end: { dateTime: '2026-07-24T10:00', timeZone: 'UTC' },
      },
    };
    const host = document.createElement('div');
    document.body.append(host);
    const app = new CalendarApp({
      views: [monthView],
      temporal: Temporal as never,
      date: '2026-07-22',
      view: 'month',
      events: [event],
      resources: [{ id: 'room', title: 'Sala', capacity: 1 }],
      options: { timeZone: 'UTC', startHour: 8, endHour: 18 },
      constraints: {
        businessHours: [{ daysOfWeek: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '18:00' }],
        blocked: [
          { scope: 'day', date: '2026-07-24' },
          { scope: 'time', date: '2026-07-23', startTime: '08:00', endTime: '17:55' },
        ],
      },
      getDayStyle: ({ dateISO }) =>
        dateISO === '2026-07-24' ? { backgroundColor: '#fee2e2' } : undefined,
      onDateClick: vi.fn(),
      onEventClick,
    });
    app.mount(host);
    await app.ready();
    try {
      const day = (date: string) =>
        host.querySelector<HTMLElement>(`[data-mc-month-day="${date}"]`)!;
      expect(day('2026-07-26').dataset.mcUnavailable).toBe('true');
      expect(day('2026-07-24').classList.contains('mc-unavailable')).toBe(true);
      expect(day('2026-07-23').hasAttribute('data-mc-unavailable')).toBe(false);
      expect(day('2026-07-24').style.backgroundColor).toBe('rgb(254, 226, 226)');
      expect(
        day('2026-07-24').querySelector('button.mc-month-daynum')?.getAttribute('aria-label'),
      ).toContain('sem horários disponíveis');
      expect(host.querySelector('[data-mc-availability-legend]')?.textContent).toContain(
        'cada recurso pode variar',
      );
      const existing = day('2026-07-24').querySelector<HTMLElement>('[data-mc-event]')!;
      expect(existing.title).toBe('Consulta já reservada');
      existing.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(onEventClick).toHaveBeenCalledTimes(1);
    } finally {
      app.destroy();
      host.remove();
    }
  });
  it('intersects allowed ranges, unions blocking intervals and reacts to displayed hours without using resource capacity', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const app = new CalendarApp({
      views: [monthView],
      temporal: Temporal as never,
      date: '2026-07-22',
      view: 'month',
      resources: [
        {
          id: 'closed-room',
          title: 'Sala fechada quinta',
          capacity: 1,
          businessHours: [{ daysOfWeek: [1], startTime: '08:00', endTime: '18:00' }],
        },
      ],
      options: { timeZone: 'UTC', startHour: 8, endHour: 18 },
      constraints: {
        allowedRanges: [
          { start: '2026-07-23', end: '2026-07-23', startTime: '09:00', endTime: '10:00' },
        ],
        blocked: [{ scope: 'time', date: '2026-07-23', startTime: '09:30', endTime: '10:00' }],
      },
    });
    app.mount(host);
    await app.ready();
    const closed = (date: string) =>
      host.querySelector(`[data-mc-month-day="${date}"]`)!.hasAttribute('data-mc-unavailable');
    try {
      expect(closed('2026-07-22')).toBe(true);
      expect(closed('2026-07-23')).toBe(false);
      app.setOptions({ startHour: 10, endHour: 18 });
      expect(closed('2026-07-23')).toBe(true);
      app.setOptions({ startHour: 8, endHour: 18 });
      app.setConstraints({
        blocked: [
          { scope: 'time', date: '2026-07-23', startTime: '08:00', endTime: '12:00' },
          { scope: 'time', date: '2026-07-23', startTime: '12:00', endTime: '18:00' },
        ],
      });
      expect(closed('2026-07-23')).toBe(true);
      app.setConstraints({});
      expect(closed('2026-07-23')).toBe(false);
      expect(host.querySelector('[data-mc-availability-legend]')).toBeNull();
    } finally {
      app.destroy();
      host.remove();
    }
  });
});
