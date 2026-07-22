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

function ruleModel(recurrence: Recurrence): RRuleModel | null {
  if (!recurrence.rule) return null;
  return typeof recurrence.rule === 'string' ? parseRRule(recurrence.rule) : recurrence.rule;
}

/** Extrai a data-base (PlainDate) do início do evento. */
function startPlainDate(temporal: TemporalLike, event: CalendarEvent): PlainDate {
  const start = event.time.start;
  const isoString = event.time.allDay ? start.date : start.dateTime;
  if (!isoString) throw new Error(`[meucalendario] evento ${event.id} sem start válido`);
  return temporal.PlainDate.from(isoString.slice(0, 10));
}

interface TimeShape {
  allDay: boolean;
  /** 'HH:mm:ss' para timed. */
  startTime: string | null;
  /** duração em dias (all-day). */
  durationDaysAllDay: number;
  /** duração (timed) como Duration do Temporal. */
  durationForTimed: ReturnType<InstanceType<TemporalLike['PlainDateTime']>['since']> | null;
  timeZone: string | undefined;
}

function timeShape(temporal: TemporalLike, event: CalendarEvent): TimeShape {
  if (event.time.allDay) {
    const startDate = temporal.PlainDate.from(event.time.start.date!.slice(0, 10));
    const endDate = event.time.end.date
      ? temporal.PlainDate.from(event.time.end.date.slice(0, 10))
      : startDate.add({ days: 1 });
    const spanDays = endDate.since(startDate).days || 1;
    return {
      allDay: true,
      startTime: null,
      durationDaysAllDay: Math.max(1, spanDays),
      durationForTimed: null,
      timeZone: event.time.start.timeZone,
    };
  }
  const startDateTime = temporal.PlainDateTime.from(event.time.start.dateTime!);
  const endDateTime = temporal.PlainDateTime.from(event.time.end.dateTime!);
  return {
    allDay: false,
    startTime: startDateTime.toPlainTime().toString(),
    durationDaysAllDay: 0,
    durationForTimed: endDateTime.since(startDateTime),
    timeZone: event.time.start.timeZone,
  };
}

/** Constrói o start/end de uma ocorrência numa data. Retorna também a chave originalStart. */
function occurrenceTimes(
  temporal: TemporalLike,
  shape: TimeShape,
  date: PlainDate,
): {
  start: CalendarEvent['time']['start'];
  end: CalendarEvent['time']['end'];
  originalStart: string;
} {
  if (shape.allDay) {
    const endDate = date.add({ days: shape.durationDaysAllDay });
    const startIso = date.toString();
    return {
      start: { date: startIso, ...(shape.timeZone ? { timeZone: shape.timeZone } : {}) },
      end: { date: endDate.toString(), ...(shape.timeZone ? { timeZone: shape.timeZone } : {}) },
      originalStart: startIso,
    };
  }
  const startDateTime = date.toPlainDateTime(temporal.PlainTime.from(shape.startTime!));
  const endDateTime = startDateTime.add(shape.durationForTimed!);
  const startIso = startDateTime.toString();
  return {
    start: { dateTime: startIso, ...(shape.timeZone ? { timeZone: shape.timeZone } : {}) },
    end: { dateTime: endDateTime.toString(), ...(shape.timeZone ? { timeZone: shape.timeZone } : {}) },
    originalStart: startIso,
  };
}

/** Aplica um override (parcial ou cancelamento) ao evento-base para uma ocorrência. */
function applyOverride(
  baseEvent: CalendarEvent,
  recurrence: Recurrence,
  originalStart: string,
): CalendarEvent | null {
  const override =
    recurrence.overrides?.[originalStart] ?? recurrence.overrides?.[originalStart.slice(0, 10)];
  if (!override) return baseEvent;
  if (isCancelledOverride(override)) return null;
  return { ...baseEvent, ...override, time: override.time ?? baseEvent.time };
}

/**
 * Expande um evento (recorrente ou não) em ocorrências virtuais dentro de `window`.
 */
export function expandEvent(
  temporal: TemporalLike,
  event: CalendarEvent,
  window: ExpandWindow = {},
): EventOccurrence[] {
  const shape = timeShape(temporal, event);
  const windowStart = window.start ? temporal.PlainDate.from(window.start) : undefined;
  const windowEnd = window.end ? temporal.PlainDate.from(window.end) : undefined;

  // Sem recorrência: uma única ocorrência (o próprio mestre).
  if (!event.recurrence || (!event.recurrence.rule && !event.recurrence.rDates?.length)) {
    const baseDate = startPlainDate(temporal, event);
    if (windowStart && temporal.PlainDate.compare(baseDate, windowStart) < 0) return [];
    if (windowEnd && temporal.PlainDate.compare(baseDate, windowEnd) > 0) return [];
    const times = occurrenceTimes(temporal, shape, baseDate);
    return [
      {
        event: { ...event, time: { allDay: shape.allDay, start: times.start, end: times.end } },
        masterId: event.id,
        originalStart: times.originalStart,
        isMaster: true,
      },
    ];
  }

  const recurrence = event.recurrence;
  const model = ruleModel(recurrence);
  const dtStart = startPlainDate(temporal, event);

  const excludedDates = new Set<string>((recurrence.exDates ?? []).map((iso) => iso.slice(0, 10)));

  const dates: PlainDate[] = [];
  if (model) {
    const expandOptions: ExpandOptions = {};
    if (windowStart) expandOptions.windowStart = windowStart;
    if (windowEnd) expandOptions.windowEnd = windowEnd;
    for (const date of expandRule(temporal, model, dtStart, excludedDates, expandOptions)) {
      dates.push(date);
    }
  }

  // RDATE: datas extras (não contam para COUNT). Respeita janela e EXDATE.
  for (const rDate of recurrence.rDates ?? []) {
    const plainDate = temporal.PlainDate.from(rDate.slice(0, 10));
    if (excludedDates.has(plainDate.toString())) continue;
    if (windowStart && temporal.PlainDate.compare(plainDate, windowStart) < 0) continue;
    if (windowEnd && temporal.PlainDate.compare(plainDate, windowEnd) > 0) continue;
    dates.push(plainDate);
  }

  // dedup + sort
  const seenKeys = new Set<string>();
  const uniqueDates = dates
    .filter((date) => {
      const key = date.toString();
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    })
    .sort((left, right) => temporal.PlainDate.compare(left, right));

  const results: EventOccurrence[] = [];
  for (const date of uniqueDates) {
    const times = occurrenceTimes(temporal, shape, date);
    const effectiveEvent = applyOverride(event, recurrence, times.originalStart);
    if (effectiveEvent === null) continue; // cancelada
    const isMaster = date.toString() === dtStart.toString();
    const occurrenceTime =
      effectiveEvent.time && effectiveEvent !== event
        ? effectiveEvent.time
        : { allDay: shape.allDay, start: times.start, end: times.end };
    results.push({
      event: { ...effectiveEvent, time: occurrenceTime },
      masterId: event.id,
      originalStart: times.originalStart,
      isMaster,
    });
  }
  return results;
}
