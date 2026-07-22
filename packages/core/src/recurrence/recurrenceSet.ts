/**
 * Recurrence-set — compõe a expansão de datas (engine) com a hora/timezone do evento,
 * aplicando RDATE (datas extras), EXDATE (remoções) e overrides (edição/cancelamento por ocorrência).
 * Produz EventOccurrence[] (ocorrências virtuais) dentro de uma janela.
 *
 * Semântica de COUNT: EXDATE reduz o conjunto final mas as ocorrências excluídas ainda CONTAM
 * para COUNT (paridade com rrule.js validada em Fase 0). Por isso EXDATE (parte de data) é
 * repassado ao engine.
 */
import type {
  CalendarEvent,
  EventOccurrence,
  Recurrence,
  RRuleModel,
} from '../types/index.js';
import { isCancelledOverride } from '../types/index.js';
import type { TemporalLike } from '../date/temporal.js';
import { expandRule, type ExpandOptions } from './engine.js';
import { parseRRule } from './parser.js';

type PlainDate = InstanceType<TemporalLike['PlainDate']>;

export interface ExpandWindow {
  /** 'YYYY-MM-DD' inclusivo. */
  start?: string;
  /** 'YYYY-MM-DD' inclusivo. */
  end?: string;
}

function ruleModel(rec: Recurrence): RRuleModel | null {
  if (!rec.rule) return null;
  return typeof rec.rule === 'string' ? parseRRule(rec.rule) : rec.rule;
}

/** Extrai a data-base (PlainDate) do início do evento. */
function startPlainDate(T: TemporalLike, ev: CalendarEvent): PlainDate {
  const s = ev.time.start;
  const iso = ev.time.allDay ? s.date : s.dateTime;
  if (!iso) throw new Error(`[meucalendario] evento ${ev.id} sem start válido`);
  return T.PlainDate.from(iso.slice(0, 10));
}

interface TimeShape {
  allDay: boolean;
  /** 'HH:mm:ss' para timed. */
  startTime: string | null;
  /** duração em nanos (timed) ou dias (all-day). */
  durationDaysAllDay: number;
  durationForTimed: ReturnType<InstanceType<TemporalLike['PlainDateTime']>['since']> | null;
  timeZone: string | undefined;
}

function timeShape(T: TemporalLike, ev: CalendarEvent): TimeShape {
  if (ev.time.allDay) {
    const startD = T.PlainDate.from(ev.time.start.date!.slice(0, 10));
    const endD = ev.time.end.date
      ? T.PlainDate.from(ev.time.end.date.slice(0, 10))
      : startD.add({ days: 1 });
    const span = endD.since(startD).days || 1;
    return {
      allDay: true,
      startTime: null,
      durationDaysAllDay: Math.max(1, span),
      durationForTimed: null,
      timeZone: ev.time.start.timeZone,
    };
  }
  const sdt = T.PlainDateTime.from(ev.time.start.dateTime!);
  const edt = T.PlainDateTime.from(ev.time.end.dateTime!);
  return {
    allDay: false,
    startTime: sdt.toPlainTime().toString(),
    durationDaysAllDay: 0,
    durationForTimed: edt.since(sdt),
    timeZone: ev.time.start.timeZone,
  };
}

/** Constrói o start/end de uma ocorrência numa data. Retorna também a chave originalStart. */
function occurrenceTimes(
  T: TemporalLike,
  shape: TimeShape,
  date: PlainDate,
): { start: CalendarEvent['time']['start']; end: CalendarEvent['time']['end']; originalStart: string } {
  if (shape.allDay) {
    const endDate = date.add({ days: shape.durationDaysAllDay });
    const startISO = date.toString();
    return {
      start: { date: startISO, ...(shape.timeZone ? { timeZone: shape.timeZone } : {}) },
      end: { date: endDate.toString(), ...(shape.timeZone ? { timeZone: shape.timeZone } : {}) },
      originalStart: startISO,
    };
  }
  const startDT = date.toPlainDateTime(T.PlainTime.from(shape.startTime!));
  const endDT = startDT.add(shape.durationForTimed!);
  const startISO = startDT.toString();
  return {
    start: { dateTime: startISO, ...(shape.timeZone ? { timeZone: shape.timeZone } : {}) },
    end: { dateTime: endDT.toString(), ...(shape.timeZone ? { timeZone: shape.timeZone } : {}) },
    originalStart: startISO,
  };
}

/** Aplica um override (parcial ou cancelamento) ao evento-base para uma ocorrência. */
function applyOverride(
  base: CalendarEvent,
  rec: Recurrence,
  originalStart: string,
): CalendarEvent | null {
  const ov = rec.overrides?.[originalStart] ?? rec.overrides?.[originalStart.slice(0, 10)];
  if (!ov) return base;
  if (isCancelledOverride(ov)) return null;
  return { ...base, ...ov, time: ov.time ?? base.time };
}

/**
 * Expande um evento (recorrente ou não) em ocorrências virtuais dentro de `window`.
 */
export function expandEvent(
  T: TemporalLike,
  event: CalendarEvent,
  window: ExpandWindow = {},
): EventOccurrence[] {
  const shape = timeShape(T, event);
  const winStart = window.start ? T.PlainDate.from(window.start) : undefined;
  const winEnd = window.end ? T.PlainDate.from(window.end) : undefined;

  // Sem recorrência: uma única ocorrência (o próprio mestre).
  if (!event.recurrence || (!event.recurrence.rule && !event.recurrence.rDates?.length)) {
    const base = startPlainDate(T, event);
    if (winStart && T.PlainDate.compare(base, winStart) < 0) return [];
    if (winEnd && T.PlainDate.compare(base, winEnd) > 0) return [];
    const times = occurrenceTimes(T, shape, base);
    return [
      {
        event: { ...event, time: { allDay: shape.allDay, start: times.start, end: times.end } },
        masterId: event.id,
        originalStart: times.originalStart,
        isMaster: true,
      },
    ];
  }

  const rec = event.recurrence;
  const model = ruleModel(rec);
  const dtstart = startPlainDate(T, event);

  const exDateSet = new Set<string>((rec.exDates ?? []).map((d) => d.slice(0, 10)));

  const dates: PlainDate[] = [];
  if (model) {
    const opts: ExpandOptions = {};
    if (winStart) opts.windowStart = winStart;
    if (winEnd) opts.windowEnd = winEnd;
    for (const d of expandRule(T, model, dtstart, exDateSet, opts)) {
      dates.push(d);
    }
  }

  // RDATE: datas extras (não contam para COUNT). Respeita janela e EXDATE.
  for (const rd of rec.rDates ?? []) {
    const pd = T.PlainDate.from(rd.slice(0, 10));
    if (exDateSet.has(pd.toString())) continue;
    if (winStart && T.PlainDate.compare(pd, winStart) < 0) continue;
    if (winEnd && T.PlainDate.compare(pd, winEnd) > 0) continue;
    dates.push(pd);
  }

  // dedup + sort
  const seen = new Set<string>();
  const uniqueDates = dates
    .filter((d) => {
      const k = d.toString();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => T.PlainDate.compare(a, b));

  const out: EventOccurrence[] = [];
  for (const d of uniqueDates) {
    const times = occurrenceTimes(T, shape, d);
    const effective = applyOverride(event, rec, times.originalStart);
    if (effective === null) continue; // cancelada
    const isMaster = d.toString() === dtstart.toString();
    const evtTime = effective.time && effective !== event ? effective.time : { allDay: shape.allDay, start: times.start, end: times.end };
    out.push({
      event: { ...effective, time: evtTime },
      masterId: event.id,
      originalStart: times.originalStart,
      isMaster,
    });
  }
  return out;
}
