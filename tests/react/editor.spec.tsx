// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Temporal } from 'temporal-polyfill';
import { CalendarEventEditor } from '../../src/react/CalendarEventEditor.js';
import type { CalendarEvent } from '../../src/core/index.js';
afterEach(cleanup);
const event: CalendarEvent = {
  id: 'e',
  calendarId: 'c',
  title: 'Consulta',
  time: { allDay: true, start: { date: '2026-10-07' }, end: { date: '2026-10-09' } },
  recurrence: { rule: 'FREQ=WEEKLY;COUNT=3' },
};
it('editor validates an occurrence, reports rejection, and saves inclusive all-day input as exclusive end', async () => {
  const onSave = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  const validate = vi.fn().mockResolvedValue(undefined);
  render(
    <CalendarEventEditor
      event={event}
      temporal={Temporal as never}
      occurrence={{ event, masterId: 'e', originalStart: '2026-10-07', isMaster: false }}
      validate={validate}
      onSave={onSave}
      onCancel={() => {}}
    />,
  );
  fireEvent.change(screen.getByLabelText('Último dia'), { target: { value: '2026-10-10' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar evento' }));
  await screen.findByRole('alert');
  expect(onSave.mock.calls[0]?.[0].time.end.date).toBe('2026-10-11');
  expect(onSave.mock.calls[0]?.[1].scope).toBe('occurrence');
  fireEvent.click(screen.getByRole('button', { name: 'Salvar evento' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
  expect(validate).toHaveBeenCalledTimes(2);
});
it('editor rejects a DST gap before calling persistence', async () => {
  const onSave = vi.fn();
  const timed = {
    ...event,
    recurrence: undefined,
    time: {
      allDay: false,
      start: { dateTime: '2024-03-09T02:30:00', timeZone: 'America/New_York' },
      end: { dateTime: '2024-03-09T03:30:00', timeZone: 'America/New_York' },
    },
  };
  const { container } = render(
    <CalendarEventEditor
      event={timed}
      temporal={Temporal as never}
      onSave={onSave}
      onCancel={() => {}}
    />,
  );
  await waitFor(() =>
    expect(
      (container.querySelector('input[type="datetime-local"]') as HTMLInputElement).value,
    ).toBe('2024-03-09T02:30'),
  );
  fireEvent.change(screen.getByLabelText('Início'), { target: { value: '2024-03-10T02:30' } });
  fireEvent.change(screen.getByLabelText('Término'), { target: { value: '2024-03-10T03:30' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar evento' }));
  await screen.findByRole('alert');
  expect(onSave).not.toHaveBeenCalled();
});

it('editing title or interval preserves advanced recurrence clauses and exceptions', async () => {
  const advanced = {
    ...event,
    recurrence: {
      rule: 'FREQ=MONTHLY;BYDAY=MO,TU,WE,TH,FR;BYSETPOS=-1;BYMONTH=1,3;COUNT=8;WKST=SU',
      exDates: ['2026-10-30'],
    },
  };
  const onSave = vi.fn();
  render(
    <CalendarEventEditor
      event={advanced}
      temporal={Temporal as never}
      onSave={onSave}
      onCancel={() => {}}
    />,
  );
  fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Último dia útil' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar evento' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  expect(onSave.mock.calls[0]?.[0].recurrence).toEqual(advanced.recurrence);
  await waitFor(() =>
    expect(
      (screen.getByRole('button', { name: 'Salvar evento' }) as HTMLButtonElement).disabled,
    ).toBe(false),
  );
  fireEvent.change(screen.getByLabelText('Intervalo da repetição'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar evento' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
  expect(onSave.mock.calls[1]?.[0].recurrence).toMatchObject({
    exDates: ['2026-10-30'],
    rule: {
      freq: 'MONTHLY',
      interval: 2,
      count: 8,
      bySetPos: [-1],
      byMonth: [1, 3],
      weekStart: 'SU',
      byDay: [
        { weekday: 'MO' },
        { weekday: 'TU' },
        { weekday: 'WE' },
        { weekday: 'TH' },
        { weekday: 'FR' },
      ],
    },
  });
});

it('new weekly recurrence enables weekdays and saves interval and count', async () => {
  const onSave = vi.fn();
  render(
    <CalendarEventEditor
      event={{ ...event, recurrence: undefined }}
      temporal={Temporal as never}
      onSave={onSave}
      onCancel={() => {}}
    />,
  );
  expect(screen.queryByLabelText('Intervalo da repetição')).toBeNull();
  fireEvent.change(screen.getByLabelText('Repetir'), { target: { value: 'WEEKLY' } });
  fireEvent.click(screen.getByLabelText(/sexta-feira/i));
  fireEvent.change(screen.getByLabelText('Intervalo da repetição'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Fim da repetição'), { target: { value: 'count' } });
  fireEvent.change(screen.getByLabelText('Quantidade de ocorrências'), { target: { value: '6' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar evento' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  expect(onSave.mock.calls[0]?.[0].recurrence.rule).toEqual({
    freq: 'WEEKLY',
    interval: 2,
    count: 6,
    byDay: [{ weekday: 'WE' }, { weekday: 'FR' }],
  });
});

it('yearly recurrence exposes month/day and an inclusive final date', async () => {
  const onSave = vi.fn();
  render(
    <CalendarEventEditor
      event={{ ...event, recurrence: undefined }}
      temporal={Temporal as never}
      onSave={onSave}
      onCancel={() => {}}
    />,
  );
  fireEvent.change(screen.getByLabelText('Repetir'), { target: { value: 'DAILY' } });
  expect(screen.queryByLabelText(/segunda-feira/i)).toBeNull();
  expect(screen.queryByLabelText('Dia do mês da repetição')).toBeNull();
  fireEvent.change(screen.getByLabelText('Repetir'), { target: { value: 'MONTHLY' } });
  expect(screen.getByLabelText('Dia do mês da repetição')).toBeTruthy();
  expect(screen.queryByLabelText('Mês da repetição')).toBeNull();
  fireEvent.change(screen.getByLabelText('Repetir'), { target: { value: 'YEARLY' } });
  fireEvent.change(screen.getByLabelText('Mês da repetição'), { target: { value: '12' } });
  fireEvent.change(screen.getByLabelText('Dia do mês da repetição'), { target: { value: '20' } });
  fireEvent.change(screen.getByLabelText('Fim da repetição'), { target: { value: 'until' } });
  fireEvent.change(screen.getByLabelText('Data final da repetição'), {
    target: { value: '2028-12-20' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar evento' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  expect(onSave.mock.calls[0]?.[0].recurrence.rule).toEqual({
    freq: 'YEARLY',
    interval: 1,
    until: '2028-12-20',
    byMonth: [12],
    byMonthDay: [20],
  });
});

it('recurrence validation rejects zero interval and a final date before start', async () => {
  const onSave = vi.fn();
  render(
    <CalendarEventEditor
      event={event}
      temporal={Temporal as never}
      onSave={onSave}
      onCancel={() => {}}
    />,
  );
  fireEvent.change(screen.getByLabelText('Intervalo da repetição'), { target: { value: '0' } });
  fireEvent.submit(screen.getByRole('form', { name: 'Editar evento' }));
  expect((await screen.findByRole('alert')).textContent).toContain('inteiro positivo');
  expect(onSave).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Intervalo da repetição'), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('Fim da repetição'), { target: { value: 'until' } });
  fireEvent.change(screen.getByLabelText('Data final da repetição'), {
    target: { value: '2026-10-06' },
  });
  fireEvent.submit(screen.getByRole('form', { name: 'Editar evento' }));
  expect((await screen.findByRole('alert')).textContent).toContain('igual ou posterior');
  expect(onSave).not.toHaveBeenCalled();
});

it('switching to occurrence scope ignores staged series rule changes', async () => {
  const onSave = vi.fn();
  render(
    <CalendarEventEditor
      event={event}
      occurrence={{ event, masterId: 'e', originalStart: '2026-10-07', isMaster: false }}
      temporal={Temporal as never}
      onSave={onSave}
      onCancel={() => {}}
    />,
  );
  fireEvent.change(screen.getByLabelText('Aplicar alterações'), { target: { value: 'series' } });
  fireEvent.change(screen.getByLabelText('Intervalo da repetição'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('Aplicar alterações'), {
    target: { value: 'occurrence' },
  });
  expect(screen.queryByLabelText('Intervalo da repetição')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Salvar evento' }));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  expect(onSave.mock.calls[0]?.[0].recurrence).toEqual(event.recurrence);
  expect(onSave.mock.calls[0]?.[1].scope).toBe('occurrence');
});
it('supports partial editor dictionaries, live updates and locale weekday names', async () => {
  const props = {
    event,
    temporal: Temporal as never,
    locale: 'es-ES',
    onSave: vi.fn().mockResolvedValue(false),
    onCancel: vi.fn(),
    messages: {
      title: 'Título de la cita',
      saveEvent: 'Guardar',
      saveFailed: 'No se pudo guardar',
    },
  };
  const editor = render(<CalendarEventEditor {...props} />);
  expect(screen.getByLabelText('Título de la cita')).toBeTruthy();
  expect(screen.getByRole('checkbox', { name: 'lunes' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Cancelar' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  expect((await screen.findByRole('alert')).textContent).toBe('No se pudo guardar');
  editor.rerender(
    <CalendarEventEditor {...props} locale="en-US" messages={{ title: 'Appointment name' }} />,
  );
  expect(screen.getByLabelText('Appointment name')).toBeTruthy();
  expect(screen.getByRole('checkbox', { name: 'Monday' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Save event' })).toBeTruthy();
});

it('translates recurrence validation templates without calling persistence', async () => {
  const onSave = vi.fn();
  render(
    <CalendarEventEditor
      event={event}
      temporal={Temporal as never}
      onSave={onSave}
      onCancel={() => {}}
      messages={{
        intervalName: 'Intervalo',
        positiveIntegerError: '{field} debe ser positivo',
        saveEvent: 'Guardar',
      }}
    />,
  );
  fireEvent.change(screen.getByLabelText('Intervalo da repetição'), { target: { value: '0' } });
  fireEvent.submit(screen.getByRole('form'));
  expect((await screen.findByRole('alert')).textContent).toBe('Intervalo debe ser positivo');
  expect(onSave).not.toHaveBeenCalled();
});

it.each(['SECONDLY', 'MINUTELY', 'HOURLY'])(
  'edits timed %s recurrence with interval units and preserves zone',
  async (frequency) => {
    const onSave = vi.fn();
    const timed: CalendarEvent = {
      ...event,
      recurrence: undefined,
      time: {
        allDay: false,
        start: { dateTime: '2026-10-07T09:00:00', timeZone: 'America/Sao_Paulo' },
        end: { dateTime: '2026-10-07T09:30:00', timeZone: 'America/Sao_Paulo' },
      },
    };
    render(
      <CalendarEventEditor
        event={timed}
        temporal={Temporal as never}
        locale="en-US"
        onSave={onSave}
        onCancel={() => {}}
      />,
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Start').getAttribute('value')).toBe('2026-10-07T09:00:00'),
    );
    fireEvent.change(screen.getByLabelText('Repeat'), { target: { value: frequency } });
    fireEvent.change(screen.getByLabelText('Recurrence interval'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save event' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].recurrence.rule).toMatchObject({
      freq: frequency,
      interval: 2,
      count: 10,
    });
    expect(onSave.mock.calls[0][0].time.start.timeZone).toBe('America/Sao_Paulo');
  },
);
it('rejects intraday all-day recurrence through a translated error before saving', async () => {
  const onSave = vi.fn();
  render(
    <CalendarEventEditor
      event={{ ...event, recurrence: { rule: 'FREQ=HOURLY;COUNT=3' } }}
      temporal={Temporal as never}
      locale="en-US"
      messages={{ allDayRecurrenceInvalid: 'Use una cita con horario', cancel: undefined }}
      onSave={onSave}
      onCancel={() => {}}
    />,
  );
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Save event' }));
  expect((await screen.findByRole('alert')).textContent).toBe('Use una cita con horario');
  expect(onSave).not.toHaveBeenCalled();
});
