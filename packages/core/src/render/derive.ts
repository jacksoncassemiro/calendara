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
import type { GeoInput } from '../geometry/geometry.js';

type PlainDate = InstanceType<TemporalLike['PlainDate']>;

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

function occurrenceKey(occurrence: EventOccurrence): string {
  return `${occurrence.masterId}@${occurrence.originalStart}`;
}

function toMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':');
  return parseInt(hours ?? '0', 10) * 60 + parseInt(minutes ?? '0', 10);
}

/** Expande todos os eventos no range [startISO, endISO] (datas inclusivas). Memoizável por chamador. */
export function expandRange(
  temporal: TemporalLike,
  events: readonly CalendarEvent[],
  startISO: string,
  endISO: string,
): EventOccurrence[] {
  const results: EventOccurrence[] = [];
  for (const event of events) {
    for (const occurrence of expandEvent(temporal, event, { start: startISO, end: endISO })) {
      results.push(occurrence);
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
  return plainDateTime.toZonedDateTime(sourceTimeZone).withTimeZone(displayTimeZone);
}

/**
 * Distribui ocorrências pelos dias visíveis, projetando os timed em minutos-do-dia de exibição.
 * Eventos que cruzam a meia-noite são ancorados no dia de início e recortados (Fase 2).
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
      const dayIso = (time.start.date ?? '').slice(0, 10);
      dataByDay.get(dayIso)?.allDay.push(occurrence);
      continue;
    }
    const startZoned = toDisplayZoned(temporal, time.start, displayTimeZone);
    const endZoned = toDisplayZoned(temporal, time.end, displayTimeZone);
    const dayIso = startZoned.toPlainDate().toString();
    const column = dataByDay.get(dayIso);
    if (!column) continue; // fora dos dias visíveis
    const startMin = startZoned.hour * 60 + startZoned.minute;
    const endsSameDay = endZoned.toPlainDate().toString() === dayIso;
    const endMin = endsSameDay ? endZoned.hour * 60 + endZoned.minute : 1440;
    column.timed.push({
      id: occurrenceKey(occurrence),
      startMin,
      endMin: Math.max(endMin, startMin),
      occurrence,
    });
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
  if (businessHours.length === 0) return []; // sem regra = sempre aberto (nada sombreado)
  const dayOfWeek = jsDayOfWeek(dateISO);
  const openSegments: Segment[] = [];
  for (const rule of businessHours) {
    if (!rule.daysOfWeek.includes(dayOfWeek)) continue;
    if (rule.start && dateISO < rule.start) continue;
    if (rule.end && dateISO > rule.end) continue;
    const start = Math.max(toMinutes(rule.startTime), gridStartMin);
    const end = Math.min(toMinutes(rule.endTime), gridEndMin);
    if (end > start) openSegments.push({ startMin: start, endMin: end });
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
    if (blocking.date !== dateISO) continue;
    if (blocking.scope === 'day') return [{ startMin: gridStartMin, endMin: gridEndMin }];
    const start = Math.max(blocking.start ? toMinutes(blocking.start) : gridStartMin, gridStartMin);
    const rawEnd = blocking.end ?? blocking.endTime;
    const end = Math.min(rawEnd ? toMinutes(rawEnd) : gridEndMin, gridEndMin);
    if (end > start) segments.push({ startMin: start, endMin: end });
  }
  return mergeSegments(segments);
}

/** Une segmentos sobrepostos/adjacentes. */
function mergeSegments(segments: Segment[]): Segment[] {
  if (segments.length <= 1) return segments.slice();
  const sorted = [...segments].sort((first, second) => first.startMin - second.startMin);
  const merged: Segment[] = [];
  for (const segment of sorted) {
    const last = merged[merged.length - 1];
    if (last && segment.startMin <= last.endMin) {
      last.endMin = Math.max(last.endMin, segment.endMin);
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
    if (segment.startMin > cursor) gaps.push({ startMin: cursor, endMin: segment.startMin });
    cursor = Math.max(cursor, segment.endMin);
  }
  if (cursor < upperBound) gaps.push({ startMin: cursor, endMin: upperBound });
  return gaps;
}
