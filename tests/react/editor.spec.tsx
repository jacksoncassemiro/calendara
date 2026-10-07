// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Temporal } from '@js-temporal/polyfill';
import { CalendarEventEditor } from '../../src/react/CalendarEventEditor.js';
import type { CalendarEvent } from '../../src/core/index.js';
afterEach(cleanup);
const event: CalendarEvent = {id:'e',calendarId:'c',title:'Consulta',time:{allDay:true,start:{date:'2026-10-07'},end:{date:'2026-10-09'}},recurrence:{rule:'FREQ=WEEKLY;COUNT=3'}};
it('editor validates an occurrence, reports rejection, and saves inclusive all-day input as exclusive end', async()=>{
  const onSave=vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  const validate=vi.fn().mockResolvedValue(undefined);
  render(<CalendarEventEditor event={event} temporal={Temporal as never} occurrence={{event,masterId:'e',originalStart:'2026-10-07',isMaster:false}} validate={validate} onSave={onSave} onCancel={()=>{}} />);
  fireEvent.change(screen.getByLabelText('Último dia'),{target:{value:'2026-10-10'}});
  fireEvent.click(screen.getByRole('button',{name:'Salvar evento'}));
  await screen.findByRole('alert');
  expect(onSave.mock.calls[0]?.[0].time.end.date).toBe('2026-10-11');
  expect(onSave.mock.calls[0]?.[1].scope).toBe('occurrence');
  fireEvent.click(screen.getByRole('button',{name:'Salvar evento'}));
  await waitFor(()=>expect(onSave).toHaveBeenCalledTimes(2));
  expect(validate).toHaveBeenCalledTimes(2);
});
it('editor rejects a DST gap before calling persistence', async()=>{
  const onSave=vi.fn();
  const timed={...event,recurrence:undefined,time:{allDay:false,start:{dateTime:'2024-03-09T02:30:00',timeZone:'America/New_York'},end:{dateTime:'2024-03-09T03:30:00',timeZone:'America/New_York'}}};
  const {container}=render(<CalendarEventEditor event={timed} temporal={Temporal as never} onSave={onSave} onCancel={()=>{}} />);
  await waitFor(()=>expect((container.querySelector('input[type="datetime-local"]') as HTMLInputElement).value).toBe('2024-03-09T02:30'));
  fireEvent.change(screen.getByLabelText('Início'),{target:{value:'2024-03-10T02:30'}});
  fireEvent.change(screen.getByLabelText('Término'),{target:{value:'2024-03-10T03:30'}});
  fireEvent.click(screen.getByRole('button',{name:'Salvar evento'}));
  await screen.findByRole('alert');
  expect(onSave).not.toHaveBeenCalled();
});
