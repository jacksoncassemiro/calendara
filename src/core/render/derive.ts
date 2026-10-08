/**
 * Derivações puras do render: expandir recorrência no range visível, projetar cada ocorrência
 * em minutos-do-dia (na timezone de exibição) e derivar a camada de fundo (horário comercial +
 * bloqueios) a partir do ConstraintSet. Nada de DOM/Preact aqui.
 */
import type { TemporalLike } from '../date/temporal.js';
import type { CalendarEvent, EventOccurrence } from '../types/event.js';
import type { EventDateTime } from '../types/datetime.js';
import type { ConstraintSet } from '../types/constraint.js';
import { expandEvent } from '../recurrence/recurrenceSet.js';
import { jsDayOfWeek } from '../constraint/constraintEngine.js';
import { hhmmToMinutes } from '../date/time.js';
import type { GeoInput } from '../geometry/geometry.js';

type PlainDate = InstanceType<TemporalLike['PlainDate']>;

/** Minutos num dia completo (24h) — usado como fim padrão quando um evento cruza a meia-noite. */
const MINUTES_PER_DAY = 24 * 60;

/** Segmento vertical em minutos-do-dia. */
export interface Segment {
  startMin: number;
  endMin: number;
}

/** Ocorrência timed já projetada em minutos-do-dia de exibição. */
export interface TimedPlacement extends GeoInput {
  occurrence: EventOccurrence;
}

/** Tudo que uma coluna de dia precisa desenhar. */
export interface DayData {
  date: PlainDate;
  dateISO: string;
  timed: TimedPlacement[];
  allDay: EventOccurrence[];
  /** Fora do horário comercial (sombreado). */
  nonBusiness: Segment[];
  /** Bloqueios (dia inteiro ou faixa). */
  blocked: Segment[];
}

/** Chave estável de uma ocorrência (`${masterId}@${originalStart}`). Fonte única, reusada por render/views. */
export function occurrenceKey(occurrence: EventOccurrence): string {
  return `${occurrence.masterId}@${occurrence.originalStart}`;
}

/** Expande todos os eventos no range [startISO, endISO] (datas inclusivas). Memoizável por chamador. */
export function expandRange(
  temporal: TemporalLike,
  events: readonly CalendarEvent[],
  startISO: string,
  endISO: string,
  displayTimeZone?: string,
): EventOccurrence[] {
  const results: EventOccurrence[] = [];
  const rangeStartDate = temporal.PlainDate.from(startISO);
  const rangeEndDate = temporal.PlainDate.from(endISO);
  const exclusiveRangeEnd = rangeEndDate.add({ days: 1 }).toString();
  const timedWindowEnd = rangeEndDate.add({ days: 2 }).toString();
  const lookbackWindows = new Map<number, string>();
  const zonedRanges = new Map<string, { start: InstanceType<TemporalLike['ZonedDateTime']>; end: InstanceType<TemporalLike['ZonedDateTime']> }>();
  for (const event of events) {
    // Include starts before the visible range when their duration overlaps it. Timed
    // events can also shift to the preceding/following date in the display timezone.
    const startDate = temporal.PlainDate.from((event.time.start.date ?? event.time.start.dateTime!).slice(0, 10));
    const endValue = event.time.end.date ?? event.time.end.dateTime;
    const endDate = endValue ? temporal.PlainDate.from(endValue.slice(0, 10)) : startDate.add({ days: 1 });
    const lookbackDays = Math.max(0, endDate.since(startDate).days) + (event.time.allDay ? 0 : 2);
    let windowStart = lookbackWindows.get(lookbackDays);
    if (windowStart === undefined) {
      windowStart = rangeStartDate.subtract({ days: lookbackDays }).toString();
      lookbackWindows.set(lookbackDays, windowStart);
    }
    const windowEnd = event.time.allDay ? endISO : timedWindowEnd;
    for (const occurrence of expandEvent(temporal, event, { start: windowStart, end: windowEnd })) {
      const time = occurrence.event.time;
      if (time.allDay) {
        const overlapsRange = time.start.date! < exclusiveRangeEnd && time.end.date! > startISO;
        if (overlapsRange) results.push(occurrence);
      } else {
        const timeZone = displayTimeZone ?? time.start.timeZone ?? 'UTC';
        let zonedRange = zonedRanges.get(timeZone);
        if (!zonedRange) {
          zonedRange = { start: rangeStartDate.toZonedDateTime(timeZone), end: temporal.PlainDate.from(exclusiveRangeEnd).toZonedDateTime(timeZone) };
          zonedRanges.set(timeZone, zonedRange);
        }
        const start = toDisplayZoned(temporal, time.start, timeZone);
        const end = toDisplayZoned(temporal, time.end, timeZone);
        const overlapsRange = temporal.ZonedDateTime.compare(start, zonedRange.end) < 0 && temporal.ZonedDateTime.compare(end, zonedRange.start) > 0;
        if (overlapsRange) results.push(occurrence);
      }
    }
  }
  return results;
}

/** Início de uma ocorrência projetado na timezone de exibição (para agrupar/ordenar). */
export interface OccurrenceStart {
  /** Dia 'YYYY-MM-DD' de exibição em que a ocorrência começa. */
  dayISO: string;
  /** Instante de início (epoch ms) — chave de ordenação cronológica. */
  epochMs: number;
  /** Minuto-do-dia do início (0 em all-day). */
  minuteOfDay: number;
  isAllDay: boolean;
}

/** Projeta o início de uma ocorrência na timezone de exibição. Usado por Month/List. */
export function occurrenceStart(
  temporal: TemporalLike,
  occurrence: EventOccurrence,
  displayTimeZone: string,
): OccurrenceStart {
  const time = occurrence.event.time;
  if (time.allDay) {
    const dayISO = (time.start.date ?? '').slice(0, 10);
    const startOfDay = temporal.PlainDate.from(dayISO).toZonedDateTime(displayTimeZone);
    return { dayISO, epochMs: Number(startOfDay.epochMilliseconds), minuteOfDay: 0, isAllDay: true };
  }
  const startZoned = toDisplayZoned(temporal, time.start, displayTimeZone);
  return {
    dayISO: startZoned.toPlainDate().toString(),
    epochMs: Number(startZoned.epochMilliseconds),
    minuteOfDay: startZoned.hour * 60 + startZoned.minute,
    isAllDay: false,
  };
}

/** Converte um extremo timed para ZonedDateTime na timezone de exibição. */
function toDisplayZoned(
  temporal: TemporalLike,
  eventDateTime: EventDateTime,
  displayTimeZone: string,
): InstanceType<TemporalLike['ZonedDateTime']> {
  const sourceTimeZone = eventDateTime.timeZone ?? displayTimeZone;
  const plainDateTime = temporal.PlainDateTime.from(eventDateTime.dateTime!);
  const zoned = plainDateTime.toZonedDateTime(sourceTimeZone);
  return sourceTimeZone === displayTimeZone ? zoned : zoned.withTimeZone(displayTimeZone);
}

/** Full intervals relative to a day; negative/>1440 minutes preserve adjacent-day buffers. */
export function resourceBusyIntervals(
  temporal: TemporalLike,
  day: PlainDate,
  occurrences: readonly EventOccurrence[],
  displayTimeZone: string,
): Segment[] {
  return occurrences.map(occurrence => {
    const time = occurrence.event.time;
    if (time.allDay) return {
      startMin: temporal.PlainDate.from(time.start.date!).since(day).days * MINUTES_PER_DAY,
      endMin: temporal.PlainDate.from(time.end.date!).since(day).days * MINUTES_PER_DAY,
    };
    const start = toDisplayZoned(temporal, time.start, displayTimeZone);
    const end = toDisplayZoned(temporal, time.end, displayTimeZone);
    return {
      startMin: start.toPlainDate().since(day).days * MINUTES_PER_DAY + start.hour * 60 + start.minute,
      endMin: end.toPlainDate().since(day).days * MINUTES_PER_DAY + end.hour * 60 + end.minute,
    };
  });
}

/**
 * Distribui ocorrências pelos dias visíveis, projetando os timed em minutos-do-dia de exibição.
 * Distribui continuações em cada dia; end exclusivo não cria um segmento vazio à meia-noite.
 */
export function buildDays(
  temporal: TemporalLike,
  days: readonly PlainDate[],
  occurrences: readonly EventOccurrence[],
  constraints: ConstraintSet,
  grid: { startHour: number; endHour: number },
  displayTimeZone: string,
): DayData[] {
  const gridStartMin = grid.startHour * 60;
  const gridEndMin = grid.endHour * 60;

  const dataByDay = new Map<string, DayData>();
  for (const day of days) {
    const dayIso = day.toString();
    dataByDay.set(dayIso, {
      date: day,
      dateISO: dayIso,
      timed: [],
      allDay: [],
      nonBusiness: deriveNonBusiness(constraints, dayIso, gridStartMin, gridEndMin),
      blocked: deriveBlocked(constraints, dayIso, gridStartMin, gridEndMin),
    });
  }

  for (const occurrence of occurrences) {
    const time = occurrence.event.time;
    if (time.allDay) {
      const startISO = time.start.date!.slice(0, 10);
      const endISO = time.end.date!.slice(0, 10);
      for (const column of dataByDay.values()) {
        const overlapsDay = column.dateISO >= startISO && column.dateISO < endISO;
        if (overlapsDay) column.allDay.push(occurrence);
      }
      continue;
    }
    const startZoned = toDisplayZoned(temporal, time.start, displayTimeZone);
    const endZoned = toDisplayZoned(temporal, time.end, displayTimeZone);
    const startISO = startZoned.toPlainDate().toString();
    const endISO = endZoned.toPlainDate().toString();
    for (const column of dataByDay.values()) {
      const outsideEvent = column.dateISO < startISO || column.dateISO > endISO;
      if (outsideEvent) continue;
      const startMin = column.dateISO === startISO ? startZoned.hour * 60 + startZoned.minute : 0;
      const endMin = column.dateISO === endISO ? endZoned.hour * 60 + endZoned.minute : MINUTES_PER_DAY;
      const hasDuration = endMin > startMin;
      if (!hasDuration) continue;
      column.timed.push({ id: occurrenceKey(occurrence), startMin, endMin, occurrence });
    }
  }

  return days.map((day) => dataByDay.get(day.toString())!);
}

/** Sombreado "fora do expediente" = grid − janelas de horário comercial do dia. */
function deriveNonBusiness(
  constraints: ConstraintSet,
  dateISO: string,
  gridStartMin: number,
  gridEndMin: number,
): Segment[] {
  const businessHours = constraints.businessHours ?? [];
  const hasBusinessRule = businessHours.length > 0;
  if (!hasBusinessRule) return []; // sem regra = sempre aberto (nada sombreado)
  const dayOfWeek = jsDayOfWeek(dateISO);
  const openSegments: Segment[] = [];
  for (const rule of businessHours) {
    const appliesToWeekday = rule.daysOfWeek.includes(dayOfWeek);
    const beforeValidity = rule.start !== undefined && dateISO < rule.start;
    const afterValidity = rule.end !== undefined && dateISO > rule.end;
    const ruleApplies = appliesToWeekday && !beforeValidity && !afterValidity;
    if (!ruleApplies) continue;
    const start = Math.max(hhmmToMinutes(rule.startTime), gridStartMin);
    const end = Math.min(hhmmToMinutes(rule.endTime), gridEndMin);
    const hasOpenWindow = end > start;
    if (hasOpenWindow) openSegments.push({ startMin: start, endMin: end });
  }
  return complement(mergeSegments(openSegments), gridStartMin, gridEndMin);
}

/** Bloqueios do dia (precedência total): dia inteiro → grid; faixa → intervalo recortado. */
function deriveBlocked(
  constraints: ConstraintSet,
  dateISO: string,
  gridStartMin: number,
  gridEndMin: number,
): Segment[] {
  const segments: Segment[] = [];
  for (const blocking of constraints.blocked ?? []) {
    const appliesToThisDay = blocking.date === dateISO;
    if (!appliesToThisDay) continue;
    const blocksWholeDay = blocking.scope === 'day';
    if (blocksWholeDay) return [{ startMin: gridStartMin, endMin: gridEndMin }];
    const start = Math.max(blocking.startTime ? hhmmToMinutes(blocking.startTime) : gridStartMin, gridStartMin);
    const end = Math.min(blocking.endTime ? hhmmToMinutes(blocking.endTime) : gridEndMin, gridEndMin);
    const hasSpan = end > start;
    if (hasSpan) segments.push({ startMin: start, endMin: end });
  }
  return mergeSegments(segments);
}

/** Une segmentos sobrepostos/adjacentes. */
function mergeSegments(segments: Segment[]): Segment[] {
  if (segments.length <= 1) return segments.slice();
  const sorted = [...segments].sort((first, second) => first.startMin - second.startMin);
  const merged: Segment[] = [];
  for (const segment of sorted) {
    const previous = merged[merged.length - 1];
    const overlapsPrevious = previous !== undefined && segment.startMin <= previous.endMin;
    if (overlapsPrevious) {
      previous.endMin = Math.max(previous.endMin, segment.endMin);
    } else {
      merged.push({ ...segment });
    }
  }
  return merged;
}

/** Complemento de `segments` (já mesclados) dentro de [lowerBound, upperBound). */
function complement(segments: Segment[], lowerBound: number, upperBound: number): Segment[] {
  const gaps: Segment[] = [];
  let cursor = lowerBound;
  for (const segment of segments) {
    const hasGapBefore = segment.startMin > cursor;
    if (hasGapBefore) gaps.push({ startMin: cursor, endMin: segment.startMin });
    cursor = Math.max(cursor, segment.endMin);
  }
  const hasTrailingGap = cursor < upperBound;
  if (hasTrailingGap) gaps.push({ startMin: cursor, endMin: upperBound });
  return gaps;
}
