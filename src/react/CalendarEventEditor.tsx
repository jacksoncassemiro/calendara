/** @jsxImportSource react */
import { useEffect, useId, useRef, useState } from 'react';
import { ensureTemporal, parseRRule, serializeRRule, type CalendarEvent, type CalendarResource, type EventOccurrence, type Frequency, type RRuleModel, type WeekdayCode, type TemporalLike } from '../core/index.js';

const WEEKDAYS: readonly [WeekdayCode, string][] = [['MO','Segunda-feira'],['TU','Terça-feira'],['WE','Quarta-feira'],['TH','Quinta-feira'],['FR','Sexta-feira'],['SA','Sábado'],['SU','Domingo']];
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export type CalendarEditScope = 'occurrence' | 'following' | 'series';
export interface CalendarEditorContext {
  scope: CalendarEditScope;
  occurrence?: EventOccurrence;
}
export interface CalendarEventEditorProps {
  event: CalendarEvent;
  occurrence?: EventOccurrence;
  resources?: readonly CalendarResource[];
  timeZone?: string;
  temporal?: TemporalLike;
  /** Return an error message to reject the draft before persistence (constraints/capacity). */
  validate?: (event: CalendarEvent, context: CalendarEditorContext) => string | undefined | Promise<string | undefined>;
  onSave: (event: CalendarEvent, context: CalendarEditorContext) => void | boolean | Promise<void | boolean>;
  onDelete?: (event: CalendarEvent, context: CalendarEditorContext) => void | boolean | Promise<void | boolean>;
  onCancel: () => void;
}

function previousDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/** Optional accessible form. Mount with key=occurrence key when switching the edited event. */
export function CalendarEventEditor(props: CalendarEventEditorProps) {
  const { event } = props;
  const id = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const [title, setTitle] = useState(event.title);
  const [allDay, setAllDay] = useState(event.time.allDay);
  const [start, setStart] = useState(event.time.start.date ?? event.time.start.dateTime ?? '');
  const [end, setEnd] = useState(event.time.allDay ? previousDate(event.time.end.date!) : event.time.end.dateTime ?? '');
  const [resourceIds, setResourceIds] = useState(event.resourceIds ?? []);
  const [scope, setScope] = useState<CalendarEditScope>(props.occurrence ? 'occurrence' : 'series');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const originalRule = event.recurrence?.rule;
  const parsedRule = typeof originalRule === 'string' ? parseRRule(originalRule) : originalRule;
  const [frequency, setFrequency] = useState<Frequency | ''>(parsedRule?.freq ?? '');
  const [ruleChanged, setRuleChanged] = useState(false);
  const changedRuleFields = useRef(new Set<string>());
  const markRuleField = (field: string) => { changedRuleFields.current.add(field); setRuleChanged(true); };
  const initialDate = (event.time.start.date ?? event.time.start.dateTime ?? '').slice(0,10);
  const initialWeekday = WEEKDAYS[(new Date(`${initialDate}T00:00:00Z`).getUTCDay()+6)%7]?.[0] ?? 'MO';
  const [repeatInterval,setRepeatInterval] = useState(String(parsedRule?.interval ?? 1));
  const [repeatEnd,setRepeatEnd] = useState<'never'|'count'|'until'>(parsedRule?.count ? 'count' : parsedRule?.until ? 'until' : 'never');
  const [repeatCount,setRepeatCount] = useState(String(parsedRule?.count ?? 10));
  const [repeatUntil,setRepeatUntil] = useState(parsedRule?.until?.slice(0,10) ?? initialDate);
  const [repeatWeekdays,setRepeatWeekdays] = useState<WeekdayCode[]>(parsedRule?.byDay?.map(entry=>entry.weekday) ?? [initialWeekday]);
  const [repeatMonthDay,setRepeatMonthDay] = useState(String(parsedRule?.byMonthDay?.[0] ?? Number(initialDate.slice(8,10))));
  const [repeatMonth,setRepeatMonth] = useState(String(parsedRule?.byMonth?.[0] ?? Number(initialDate.slice(5,7))));
  const recurring = !!event.recurrence || !!props.occurrence && !props.occurrence.isMaster;
  const readOnly = event.editable === false;
  useEffect(() => {
    titleRef.current?.focus();
    if (event.time.allDay) return;
    let active = true;
    void (props.temporal ? Promise.resolve(props.temporal) : ensureTemporal()).then((temporal) => {
      if (!active) return;
      const zone = props.timeZone ?? event.time.start.timeZone ?? 'UTC';
      const project = (dateTime: string, sourceZone: string | undefined) => temporal.PlainDateTime.from(dateTime)
        .toZonedDateTime(sourceZone ?? zone).withTimeZone(zone).toPlainDateTime().toString({ smallestUnit: 'second' });
      setStart(project(event.time.start.dateTime!, event.time.start.timeZone));
      setEnd(project(event.time.end.dateTime!, event.time.end.timeZone));
    }).catch(() => { if (active) setError('Não foi possível carregar o fuso horário do evento.'); });
    return () => { active = false; };
  }, []);

  const context: CalendarEditorContext = { scope, ...(props.occurrence ? { occurrence: props.occurrence } : {}) };
  const run = async (remove: boolean) => {
    if (busyRef.current || readOnly) return;
    busyRef.current = true;
    setPending(true);
    setError('');
    try {
      if (remove) {
        if (await props.onDelete?.(event, context) === false) throw new Error('Não foi possível excluir o evento.');
        return;
      }
      if (!title.trim()) throw new Error('Informe o título do evento.');
      const temporal = props.temporal ?? await ensureTemporal();
      const zone = props.timeZone ?? event.time.start.timeZone ?? 'UTC';
      let time: CalendarEvent['time'];
      if (allDay) {
        const first = temporal.PlainDate.from(start);
        const last = temporal.PlainDate.from(end);
        if (temporal.PlainDate.compare(last, first) < 0) throw new Error('O último dia precisa ser igual ou posterior ao início.');
        time = { allDay: true, start: { date: first.toString() }, end: { date: last.add({ days: 1 }).toString() } };
      } else {
        const first = temporal.PlainDateTime.from(start);
        const last = temporal.PlainDateTime.from(end);
        const firstZoned = first.toZonedDateTime(zone, { disambiguation: 'reject' });
        const lastZoned = last.toZonedDateTime(zone, { disambiguation: 'reject' });
        if (lastZoned.epochMilliseconds <= firstZoned.epochMilliseconds) throw new Error('O término precisa ser posterior ao início.');
        time = { allDay: false, start: { dateTime: first.toString(), timeZone: zone }, end: { dateTime: last.toString(), timeZone: zone } };
      }
      const updated: CalendarEvent = { ...event, title: title.trim(), time, resourceIds };
      if (scope === 'series' && ruleChanged) {
        if (frequency) {
          const changed = changedRuleFields.current;
          const rule: RRuleModel = { ...parsedRule, freq: frequency };
          const positiveInteger = (value:string,label:string) => {
            const number = Number(value);
            if (!value.trim() || !Number.isSafeInteger(number) || number <= 0) throw new Error(`${label} precisa ser um inteiro positivo.`);
            return number;
          };
          if (changed.has('interval') || !parsedRule) rule.interval = positiveInteger(repeatInterval,'O intervalo');
          if (changed.has('end') || !parsedRule) {
            delete rule.count; delete rule.until;
            if (repeatEnd==='count') rule.count=positiveInteger(repeatCount,'A quantidade de ocorrências');
            if (repeatEnd==='until') {
              const last=temporal.PlainDate.from(repeatUntil);
              if(temporal.PlainDate.compare(last,temporal.PlainDate.from(start.slice(0,10)))<0) throw new Error('O fim da repetição precisa ser igual ou posterior ao início.');
              rule.until=last.toString();
            }
          }
          if (frequency==='WEEKLY' && (changed.has('weekdays') || !parsedRule)) {
            if(!repeatWeekdays.length) throw new Error('Selecione pelo menos um dia da semana.');
            rule.byDay=repeatWeekdays.map(weekday=>({weekday}));
          }
          if ((frequency==='MONTHLY' || frequency==='YEARLY') && (changed.has('monthDay') || !parsedRule)) {
            const day=Number(repeatMonthDay);
            if(!repeatMonthDay.trim() || !Number.isSafeInteger(day) || day===0 || Math.abs(day)>31) throw new Error('O dia do mês precisa estar entre 1 e 31, ou entre -31 e -1.');
            rule.byMonthDay=[day];
          }
          if (frequency==='YEARLY' && (changed.has('month') || !parsedRule)) rule.byMonth=[positiveInteger(repeatMonth,'O mês')];
          // Validate the complete rule while retaining every untouched advanced clause.
          parseRRule(serializeRRule(rule));
          updated.recurrence={...event.recurrence,rule};
        }
        else delete updated.recurrence;
      }
      const validationError = await props.validate?.(updated, context);
      if (validationError) throw new Error(validationError);
      if (await props.onSave(updated, context) === false) throw new Error('Não foi possível salvar o evento.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível concluir. Tente novamente.');
    } finally {
      busyRef.current = false;
      setPending(false);
    }
  };

  return <form className="mc-event-editor" aria-label="Editar evento" aria-busy={pending}
    onSubmit={(submitEvent) => { submitEvent.preventDefault(); void run(false); }}>
    <fieldset disabled={pending || readOnly}>
      <legend>Editar e reagendar evento</legend>
      {readOnly && <p>Este evento permite apenas consulta.</p>}
      <label htmlFor={`${id}-title`}>Título</label>
      <input ref={titleRef} id={`${id}-title`} value={title} required onChange={(e) => setTitle(e.target.value)} />
      {recurring && <><label htmlFor={`${id}-scope`}>Aplicar alterações</label>
        <select id={`${id}-scope`} value={scope} onChange={(e) => setScope(e.target.value as CalendarEditScope)}>
          {props.occurrence && <option value="occurrence">Somente este evento</option>}
          {props.occurrence && parsedRule && <option value="following">Este e os seguintes</option>}
          <option value="series">Toda a série</option>
        </select></>}
      <label className="mc-editor-check"><input type="checkbox" checked={allDay} onChange={(e) => {
        const checked = e.target.checked;
        setAllDay(checked);
        setStart(checked ? start.slice(0, 10) : `${start.slice(0, 10)}T09:00`);
        setEnd(checked ? end.slice(0, 10) : `${end.slice(0, 10)}T10:00`);
      }} />Dia inteiro</label>
      {!allDay && <p>Fuso horário: {props.timeZone ?? event.time.start.timeZone ?? 'UTC'}</p>}
      <label htmlFor={`${id}-start`}>Início</label>
      <input id={`${id}-start`} type={allDay ? 'date' : 'datetime-local'} step={allDay ? undefined : 1} value={start} required onChange={(e) => setStart(e.target.value)} />
      <label htmlFor={`${id}-end`}>{allDay ? 'Último dia' : 'Término'}</label>
      <input id={`${id}-end`} type={allDay ? 'date' : 'datetime-local'} step={allDay ? undefined : 1} value={end} required onChange={(e) => setEnd(e.target.value)} />
      {scope === 'series' && <><label htmlFor={`${id}-repeat`}>Repetir</label>
        <select id={`${id}-repeat`} value={frequency} onChange={(e) => { setFrequency(e.target.value as Frequency | ''); markRuleField('frequency'); }}>
          <option value="">Não repetir</option><option value="DAILY">Diariamente</option>
          <option value="WEEKLY">Semanalmente</option><option value="MONTHLY">Mensalmente</option><option value="YEARLY">Anualmente</option>
        </select>
        {frequency && <fieldset><legend>Configuração da repetição</legend>
          <label htmlFor={`${id}-repeat-interval`}>Intervalo da repetição</label>
          <input id={`${id}-repeat-interval`} type="number" min={1} step={1} required value={repeatInterval} onChange={e=>{setRepeatInterval(e.target.value);markRuleField('interval');}} />
          <p>{frequency==='DAILY'?'Em dias':frequency==='WEEKLY'?'Em semanas':frequency==='MONTHLY'?'Em meses':'Em anos'}</p>
          {frequency==='WEEKLY' && <fieldset className="mc-recurrence-weekdays"><legend>Dias da semana</legend>{WEEKDAYS.map(([weekday,label])=><label className="mc-editor-check" key={weekday}>
            <input type="checkbox" checked={repeatWeekdays.includes(weekday)} onChange={e=>{setRepeatWeekdays(e.target.checked?[...repeatWeekdays,weekday]:repeatWeekdays.filter(day=>day!==weekday));markRuleField('weekdays');}} />{label}
          </label>)}</fieldset>}
          {(frequency==='MONTHLY' || frequency==='YEARLY') && <><label htmlFor={`${id}-repeat-day`}>Dia do mês da repetição</label>
            <input id={`${id}-repeat-day`} type="number" min={-31} max={31} step={1} required value={repeatMonthDay} onChange={e=>{setRepeatMonthDay(e.target.value);markRuleField('monthDay');}} />
            <p>Valores negativos contam a partir do fim do mês: -1 é o último dia.</p></>}
          {frequency==='YEARLY' && <><label htmlFor={`${id}-repeat-month`}>Mês da repetição</label>
            <select id={`${id}-repeat-month`} value={repeatMonth} onChange={e=>{setRepeatMonth(e.target.value);markRuleField('month');}}>{MONTHS.map((month,index)=><option key={month} value={index+1}>{month}</option>)}</select></>}
          <label htmlFor={`${id}-repeat-end`}>Fim da repetição</label>
          <select id={`${id}-repeat-end`} value={repeatEnd} onChange={e=>{setRepeatEnd(e.target.value as 'never'|'count'|'until');markRuleField('end');}}>
            <option value="never">Nunca</option><option value="count">Após uma quantidade</option><option value="until">Até uma data</option>
          </select>
          {repeatEnd==='count' && <><label htmlFor={`${id}-repeat-count`}>Quantidade de ocorrências</label><input id={`${id}-repeat-count`} type="number" min={1} step={1} required value={repeatCount} onChange={e=>{setRepeatCount(e.target.value);markRuleField('end');}} /></>}
          {repeatEnd==='until' && <><label htmlFor={`${id}-repeat-until`}>Data final da repetição</label><input id={`${id}-repeat-until`} type="date" required value={repeatUntil} onChange={e=>{setRepeatUntil(e.target.value);markRuleField('end');}} /></>}
          {parsedRule && <p>As cláusulas avançadas da regra existente são preservadas até que o campo correspondente seja alterado.</p>}
        </fieldset>}</>}
      {!!props.resources?.length && <fieldset><legend>Recursos</legend>
        {props.resources.map((resource) => <label className="mc-editor-check" key={resource.id}>
          <input type="checkbox" checked={resourceIds.includes(resource.id)} onChange={(e) => setResourceIds(e.target.checked
            ? [...resourceIds, resource.id] : resourceIds.filter((resourceId) => resourceId !== resource.id))} />{resource.title}
        </label>)}
      </fieldset>}
    </fieldset>
    {error && <p id={`${id}-error`} role="alert">{error}</p>}
    <div className="mc-editor-actions">
      <button type="submit" disabled={pending || readOnly}>{pending ? 'Salvando…' : 'Salvar evento'}</button>
      <button type="button" disabled={pending} onClick={props.onCancel}>Cancelar</button>
      {props.onDelete && <button type="button" disabled={pending || readOnly} onClick={() => void run(true)}>Excluir evento</button>}
    </div>
  </form>;
}
