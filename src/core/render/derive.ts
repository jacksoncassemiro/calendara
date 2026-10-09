import type { TemporalLike } from '../date/temporal.js';
import type { CalendarEvent, EventOccurrence } from '../types/event.js';
import type { EventDateTime } from '../types/datetime.js';
import type { ConstraintSet } from '../types/constraint.js';
import { expandEvent } from '../recurrence/recurrenceSet.js';
import { jsDayOfWeek } from '../constraint/constraintEngine.js';
import { hhmmToMinutes } from '../date/time.js';
import type { GeoInput } from '../geometry/geometry.js';

type PlainDate = InstanceType<TemporalLike['PlainDate']>;

const MINUTES_PER_DAY = 24 * 60;

/** Half-open interval in minutes relative to the display day.
 * @remarks Português: Intervalo de fim exclusivo em minutos relativos ao dia exibido.
 */
export interface Segment {
  /** Inclusive start in minutes relative to the day.
   * @remarks Português: Início inclusivo em minutos relativos ao dia.
   */
  startMin: number;
  /** Exclusive end in minutes relative to the day.
   * @remarks Português: Fim exclusivo em minutos relativos ao dia.
   */
  endMin: number;
}

/** Occurrence projected into the display day for event layout.
 * @remarks Português: Ocorrência projetada no dia exibido para o layout de eventos.
 */
export interface TimedPlacement extends GeoInput {
  /** Expanded occurrence retaining its original identity.
   * @remarks Português: Ocorrência expandida com identidade original preservada.
   */
  occurrence: EventOccurrence;
}

/** Events and availability background for one display day.
 * @remarks Português: Eventos e fundo de disponibilidade de um dia exibido.
 */
export interface DayData {
  /** Temporal calendar date represented by this column.
   * @remarks Português: Data Temporal do calendário representada nesta coluna.
   */
  date: PlainDate;
  /** Calendar date in YYYY-MM-DD format.
   * @remarks Português: Data do calendário em YYYY-MM-DD.
   */
  dateISO: string;
  /** Timed occurrences clipped and projected into this display day.
   * @remarks Português: Ocorrências com horário recortadas e projetadas neste dia exibido.
   */
  timed: TimedPlacement[];
  /** All-day occurrences overlapping this date.
   * @remarks Português: Ocorrências de dia inteiro que cruzam esta data.
   */
  allDay: EventOccurrence[];

  /** Unavailable background intervals outside permitted hours and ranges.
   * @remarks Português: Faixas de fundo indisponíveis fora dos horários e períodos permitidos.
   */
  nonBusiness: Segment[];

  /** Explicit blocked intervals clipped to the visible grid.
   * @remarks Português: Intervalos explicitamente bloqueados recortados à grade visível.
   */
  blocked: Segment[];
}

/** Stable occurrence key combining masterId and unchanged originalStart.
 * @remarks Português: Chave estável da ocorrência que combina masterId e originalStart preservado.
 */
export function occurrenceKey(occurrence: EventOccurrence): string {
  return `${occurrence.masterId}@${occurrence.originalStart}`;
}

/** Named inputs for expandRange.
 * @remarks Português: Entradas nomeadas de expandRange.
 */
export interface ExpandRangeInput {
  /** Injected date/time implementation.
   * @remarks Português: Implementação de datas e horários injetada.
   */
  temporal: TemporalLike;
  /** Canonical events to expand.
   * @remarks Português: Eventos canônicos a expandir.
   */
  events: readonly CalendarEvent[];
  /** Inclusive first display date.
   * @remarks Português: Primeira data exibida, inclusiva.
   */
  startISO: string;
  /** Inclusive last display date.
   * @remarks Português: Última data exibida, inclusiva.
   */
  endISO: string;
  /** IANA timezone used to project event intervals.
   * @remarks Português: Fuso IANA usado para projetar intervalos de eventos.
   */
  displayTimeZone?: string | undefined;
}

/** Expand events overlapping inclusive ISO dates, retaining multiday continuations.
 * @remarks Português: Expande eventos que cruzam datas ISO inclusivas, preservando continuações entre dias.
 */

export function expandRange({
  temporal,
  events,
  startISO,
  endISO,
  displayTimeZone,
}: ExpandRangeInput): EventOccurrence[] {
  const results: EventOccurrence[] = [];
  const rangeStartDate = temporal.PlainDate.from(startISO);
  const rangeEndDate = temporal.PlainDate.from(endISO);
  const exclusiveRangeEnd = rangeEndDate.add({ days: 1 }).toString();
  const timedWindowEnd = rangeEndDate.add({ days: 2 }).toString();
  const lookbackWindows = new Map<number, string>();
  const zonedRanges = new Map<
    string,
    {
      start: InstanceType<TemporalLike['ZonedDateTime']>;
      end: InstanceType<TemporalLike['ZonedDateTime']>;
    }
  >();
  for (const event of events) {
    const startDate = temporal.PlainDate.from(
      (event.time.start.date ?? event.time.start.dateTime!).slice(0, 10),
    );
    const endValue = event.time.end.date ?? event.time.end.dateTime;
    const endDate = endValue
      ? temporal.PlainDate.from(endValue.slice(0, 10))
      : startDate.add({ days: 1 });
    const lookbackDays = Math.max(0, endDate.since(startDate).days) + (event.time.allDay ? 0 : 2);
    let windowStart = lookbackWindows.get(lookbackDays);
    if (windowStart === undefined) {
      windowStart = rangeStartDate.subtract({ days: lookbackDays }).toString();
      lookbackWindows.set(lookbackDays, windowStart);
    }
    const windowEnd = event.time.allDay ? endISO : timedWindowEnd;
    for (const occurrence of expandEvent({
      temporal,
      event,
      window: { start: windowStart, end: windowEnd },
    })) {
      const time = occurrence.event.time;
      if (time.allDay) {
        const overlapsRange = time.start.date! < exclusiveRangeEnd && time.end.date! > startISO;
        if (overlapsRange) results.push(occurrence);
      } else {
        const timeZone = displayTimeZone ?? time.start.timeZone ?? 'UTC';
        let zonedRange = zonedRanges.get(timeZone);
        if (!zonedRange) {
          zonedRange = {
            start: rangeStartDate.toZonedDateTime(timeZone),
            end: temporal.PlainDate.from(exclusiveRangeEnd).toZonedDateTime(timeZone),
          };
          zonedRanges.set(timeZone, zonedRange);
        }
        const start = toDisplayZoned({
          temporal,
          eventDateTime: time.start,
          displayTimeZone: timeZone,
        });
        const end = toDisplayZoned({
          temporal,
          eventDateTime: time.end,
          displayTimeZone: timeZone,
        });
        const overlapsRange =
          temporal.ZonedDateTime.compare(start, zonedRange.end) < 0 &&
          temporal.ZonedDateTime.compare(end, zonedRange.start) > 0;
        if (overlapsRange) results.push(occurrence);
      }
    }
  }
  return results;
}

/** Chronological start projected into the display timezone.
 * @remarks Português: Início cronológico projetado no fuso de exibição.
 */
export interface OccurrenceStart {
  /** Display-zone start date in YYYY-MM-DD format.
   * @remarks Português: Data de início no fuso exibido em YYYY-MM-DD.
   */
  dayISO: string;

  /** Start instant in epoch milliseconds for chronological ordering.
   * @remarks Português: Instante inicial em milissegundos desde epoch para ordenação cronológica.
   */
  epochMs: number;

  /** Pointer or start position in minutes since midnight.
   * @remarks Português: Posição do ponteiro ou início em minutos desde meia-noite.
   */
  minuteOfDay: number;
  /** Whether this start belongs to an all-day occurrence.
   * @remarks Português: Indica se o início pertence a uma ocorrência de dia inteiro.
   */
  isAllDay: boolean;
}

/** Project occurrence start into the display timezone for grouping and sorting.
 * @remarks Português: Projeta o início da ocorrência no fuso exibido para agrupar e ordenar.
 */
export interface OccurrenceStartInput {
  /** Injected date/time implementation. / PT: Implementação de datas e horários injetada. */
  temporal: TemporalLike;
  /** Occurrence whose start is projected. / PT: Ocorrência cujo início será projetado. */
  occurrence: EventOccurrence;
  /** Zone used to display the instant. / PT: Fuso usado para exibir o instante. */
  displayTimeZone: string;
}

/** Project the occurrence start into the display timezone.
 * @remarks Português: Projeta o início da ocorrência no fuso de exibição.
 */

export function occurrenceStart({
  temporal,
  occurrence,
  displayTimeZone,
}: OccurrenceStartInput): OccurrenceStart {
  const time = occurrence.event.time;
  if (time.allDay) {
    const dayISO = (time.start.date ?? '').slice(0, 10);
    const startOfDay = temporal.PlainDate.from(dayISO).toZonedDateTime(displayTimeZone);
    return {
      dayISO,
      epochMs: Number(startOfDay.epochMilliseconds),
      minuteOfDay: 0,
      isAllDay: true,
    };
  }
  const startZoned = toDisplayZoned({
    temporal,
    eventDateTime: time.start,
    displayTimeZone,
  });
  return {
    dayISO: startZoned.toPlainDate().toString(),
    epochMs: Number(startZoned.epochMilliseconds),
    minuteOfDay: startZoned.hour * 60 + startZoned.minute,
    isAllDay: false,
  };
}

function toDisplayZoned({
  temporal,
  eventDateTime,
  displayTimeZone,
}: {
  /** Injected date/time implementation. / PT: Implementação de datas e horários injetada. */
  temporal: TemporalLike;
  /** Timed endpoint and its original zone. / PT: Limite temporal e seu fuso original. */
  eventDateTime: EventDateTime;
  /** Zone used to display the instant. / PT: Fuso usado para exibir o instante. */
  displayTimeZone: string;
}): InstanceType<TemporalLike['ZonedDateTime']> {
  const sourceTimeZone = eventDateTime.timeZone ?? displayTimeZone;
  const plainDateTime = temporal.PlainDateTime.from(eventDateTime.dateTime!);
  const zoned = plainDateTime.toZonedDateTime(sourceTimeZone);
  return sourceTimeZone === displayTimeZone ? zoned : zoned.withTimeZone(displayTimeZone);
}

/** Named inputs for resourceBusyIntervals.
 * @remarks Português: Entradas nomeadas de resourceBusyIntervals.
 */
export interface ResourceBusyIntervalsInput {
  /** Injected date/time implementation.
   * @remarks Português: Implementação de datas e horários injetada.
   */
  temporal: TemporalLike;
  /** Display date receiving the projected intervals.
   * @remarks Português: Data exibida que recebe os intervalos projetados.
   */
  day: PlainDate;
  /** Expanded event occurrences.
   * @remarks Português: Ocorrências expandidas dos eventos.
   */
  occurrences: readonly EventOccurrence[];
  /** IANA timezone used to project event intervals.
   * @remarks Português: Fuso IANA usado para projetar intervalos de eventos.
   */
  displayTimeZone: string;
}

/** Project full intervals relative to a day, preserving adjacent-day preparation buffers.
 * @remarks Português: Projeta intervalos completos relativos ao dia, preservando buffers de dias adjacentes.
 */

export function resourceBusyIntervals({
  temporal,
  day,
  occurrences,
  displayTimeZone,
}: ResourceBusyIntervalsInput): Segment[] {
  return occurrences.map((occurrence) => {
    const time = occurrence.event.time;
    if (time.allDay)
      return {
        startMin: temporal.PlainDate.from(time.start.date!).since(day).days * MINUTES_PER_DAY,
        endMin: temporal.PlainDate.from(time.end.date!).since(day).days * MINUTES_PER_DAY,
      };
    const start = toDisplayZoned({
      temporal,
      eventDateTime: time.start,
      displayTimeZone,
    });
    const end = toDisplayZoned({
      temporal,
      eventDateTime: time.end,
      displayTimeZone,
    });
    return {
      startMin:
        start.toPlainDate().since(day).days * MINUTES_PER_DAY + start.hour * 60 + start.minute,
      endMin: end.toPlainDate().since(day).days * MINUTES_PER_DAY + end.hour * 60 + end.minute,
    };
  });
}

/** Named inputs for buildDays.
 * @remarks Português: Entradas nomeadas de buildDays.
 */
export interface BuildDaysInput {
  /** Injected date/time implementation.
   * @remarks Português: Implementação de datas e horários injetada.
   */
  temporal: TemporalLike;
  /** Ordered display dates to populate.
   * @remarks Português: Datas exibidas e ordenadas a preencher.
   */
  days: readonly PlainDate[];
  /** Expanded event occurrences.
   * @remarks Português: Ocorrências expandidas dos eventos.
   */
  occurrences: readonly EventOccurrence[];
  /** Availability rules to evaluate.
   * @remarks Português: Regras de disponibilidade a avaliar.
   */
  constraints: ConstraintSet;
  /** Visible hour window.
   * @remarks Português: Janela de horas visíveis.
   */
  grid: { startHour: number; endHour: number };
  /** IANA timezone used to project event intervals.
   * @remarks Português: Fuso IANA usado para projetar intervalos de eventos.
   */
  displayTimeZone: string;
}

/** Distribute events over display days; exclusive midnight ends do not create empty continuations.
 * @remarks Português: Distribui eventos nos dias exibidos; fins exclusivos à meia-noite não criam continuações vazias.
 */

export function buildDays({
  temporal,
  days,
  occurrences,
  constraints,
  grid,
  displayTimeZone,
}: BuildDaysInput): DayData[] {
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
      nonBusiness: deriveNonBusiness({
        constraints,
        dateISO: dayIso,
        gridStartMin,
        gridEndMin,
      }),
      blocked: deriveBlocked({
        constraints,
        dateISO: dayIso,
        gridStartMin,
        gridEndMin,
      }),
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
    const startZoned = toDisplayZoned({
      temporal,
      eventDateTime: time.start,
      displayTimeZone,
    });
    const endZoned = toDisplayZoned({
      temporal,
      eventDateTime: time.end,
      displayTimeZone,
    });
    const startISO = startZoned.toPlainDate().toString();
    const endISO = endZoned.toPlainDate().toString();
    for (const column of dataByDay.values()) {
      const outsideEvent = column.dateISO < startISO || column.dateISO > endISO;
      if (outsideEvent) continue;
      const startMin = column.dateISO === startISO ? startZoned.hour * 60 + startZoned.minute : 0;
      const endMin =
        column.dateISO === endISO ? endZoned.hour * 60 + endZoned.minute : MINUTES_PER_DAY;
      const hasDuration = endMin > startMin;
      if (!hasDuration) continue;
      column.timed.push({ id: occurrenceKey(occurrence), startMin, endMin, occurrence });
    }
  }

  return days.map((day) => dataByDay.get(day.toString())!);
}

/** Named inputs for deriveNonBusiness.
 * @remarks Português: Entradas nomeadas de deriveNonBusiness.
 */
interface DeriveNonBusinessInput {
  /** Availability rules to evaluate.
   * @remarks Português: Regras de disponibilidade a avaliar.
   */
  constraints: ConstraintSet;
  /** Evaluated ISO date in YYYY-MM-DD.
   * @remarks Português: Data ISO avaliada em YYYY-MM-DD.
   */
  dateISO: string;
  /** Inclusive grid start in minutes.
   * @remarks Português: Início inclusivo da grade em minutos.
   */
  gridStartMin: number;
  /** Exclusive grid end in minutes.
   * @remarks Português: Fim exclusivo da grade em minutos.
   */
  gridEndMin: number;
}

function deriveNonBusiness({
  constraints,
  dateISO,
  gridStartMin,
  gridEndMin,
}: DeriveNonBusinessInput): Segment[] {
  const businessHours = constraints.businessHours ?? [];
  const hasBusinessRule = businessHours.length > 0;
  if (!hasBusinessRule) return [];
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
  return complement({
    segments: mergeSegments(openSegments),
    lowerBound: gridStartMin,
    upperBound: gridEndMin,
  });
}

/** Named inputs for deriveBlocked.
 * @remarks Português: Entradas nomeadas de deriveBlocked.
 */
interface DeriveBlockedInput {
  /** Availability rules to evaluate.
   * @remarks Português: Regras de disponibilidade a avaliar.
   */
  constraints: ConstraintSet;
  /** Evaluated ISO date in YYYY-MM-DD.
   * @remarks Português: Data ISO avaliada em YYYY-MM-DD.
   */
  dateISO: string;
  /** Inclusive grid start in minutes.
   * @remarks Português: Início inclusivo da grade em minutos.
   */
  gridStartMin: number;
  /** Exclusive grid end in minutes.
   * @remarks Português: Fim exclusivo da grade em minutos.
   */
  gridEndMin: number;
}

function deriveBlocked({
  constraints,
  dateISO,
  gridStartMin,
  gridEndMin,
}: DeriveBlockedInput): Segment[] {
  const segments: Segment[] = [];
  for (const blocking of constraints.blocked ?? []) {
    const appliesToThisDay = blocking.date === dateISO;
    if (!appliesToThisDay) continue;
    const blocksWholeDay = blocking.scope === 'day';
    if (blocksWholeDay) return [{ startMin: gridStartMin, endMin: gridEndMin }];
    const start = Math.max(
      blocking.startTime ? hhmmToMinutes(blocking.startTime) : gridStartMin,
      gridStartMin,
    );
    const end = Math.min(
      blocking.endTime ? hhmmToMinutes(blocking.endTime) : gridEndMin,
      gridEndMin,
    );
    const hasSpan = end > start;
    if (hasSpan) segments.push({ startMin: start, endMin: end });
  }
  return mergeSegments(segments);
}

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

function complement({
  segments,
  lowerBound,
  upperBound,
}: {
  /** Sorted nonoverlapping minute intervals. / PT: Intervalos em minutos ordenados e sem sobreposição. */
  segments: Segment[];
  /** Inclusive lower bound in minutes. / PT: Limite inferior inclusivo em minutos. */
  lowerBound: number;
  /** Exclusive upper bound in minutes. / PT: Limite superior exclusivo em minutos. */
  upperBound: number;
}): Segment[] {
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
