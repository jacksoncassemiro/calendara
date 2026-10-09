import { expect, it } from 'vitest';
import { formatDraftInterval } from '../../src/react/views/formatting/timeLabels.js';

it('shows candidate clock times and normalizes midnight to the next date', () => {
  expect(
    formatDraftInterval({
      draft: { dateISO: '2026-10-07', startMin: 570, endMin: 675 },
      locale: 'pt-BR',
    }),
  ).toBe('09:30–11:15');
  expect(
    formatDraftInterval({
      draft: { dateISO: '2026-10-07', startMin: 1140, endMin: 540, endDateISO: '2026-10-08' },
      locale: 'pt-BR',
    }),
  ).toBe('07/10/2026 19:00–08/10/2026 09:00');
  expect(
    formatDraftInterval({
      draft: { dateISO: '2026-12-31', startMin: 1380, endMin: 1440 },
      locale: 'en-US',
    }),
  ).toBe('12/31/2026 23:00–01/01/2027 00:00');
});

it('uses occupied all-day dates rather than exposing the exclusive end as an extra day', () => {
  expect(
    formatDraftInterval({
      draft: {
        dateISO: '2026-10-07',
        startMin: 0,
        endMin: 0,
        endDateISO: '2026-10-08',
        allDay: true,
      },
      locale: 'pt-BR',
    }),
  ).toBe('Dia inteiro · 07/10/2026');
  expect(
    formatDraftInterval({
      draft: {
        dateISO: '2026-10-07',
        startMin: 0,
        endMin: 0,
        endDateISO: '2026-10-10',
        allDay: true,
      },
      locale: 'pt-BR',
    }),
  ).toBe('Dia inteiro · 07/10/2026–09/10/2026');
});
