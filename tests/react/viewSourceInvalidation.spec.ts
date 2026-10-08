import { describe, expect, it, vi } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { CalendarApp } from '../../src/react/app/calendarApp.js';
import { dayView, monthView } from '../../src/react/views/index.js';
import type { TemporalLike } from '../../src/core/index.js';

describe('view registration and event-source invalidation', () => {
  it('does not refetch for inactive replacements or order changes; refetches changed active ranges', async () => {
    const source = vi.fn(() => []);
    const app = new CalendarApp({
      temporal: Temporal as unknown as TemporalLike,
      initialDate: '2026-10-07',
      initialView: 'day',
      views: [dayView, monthView],
      eventSource: source,
    });
    const ranges = vi.fn();
    app.on('rangeChange', ranges);
    await app.ready();
    try {
      const renamedMonth = { ...monthView, label: 'Planejamento mensal' };
      app.setViews([dayView, renamedMonth]);
      app.setViews([renamedMonth, dayView]);
      app.registerView({ ...renamedMonth, label: 'Mês atualizado' });
      expect(source).toHaveBeenCalledTimes(1);
      expect(ranges).toHaveBeenCalledTimes(1);
      app.registerView({
        ...dayView,
        getRange: (date, context) => monthView.getRange(date, context),
      });
      await vi.waitFor(() => expect(source).toHaveBeenCalledTimes(2));
      expect(ranges).toHaveBeenCalledTimes(2);
      app.setViews([renamedMonth]);
      expect(app.getState().viewName).toBe('month');
      expect(source).toHaveBeenCalledTimes(2);
      app.setViews([dayView]);
      expect(app.getState().viewName).toBe('day');
      await vi.waitFor(() => expect(source).toHaveBeenCalledTimes(3));
      expect(() => app.registerView({ ...dayView, name: '' })).toThrow();
    } finally {
      app.destroy();
    }
  });
});
