/**
 * Recurrence-set — compõe a expansão de datas (engine) com a hora/timezone do evento,
 * aplicando RDATE (datas extras), EXDATE (remoções) e overrides (edição/cancelamento por ocorrência).
 * Produz EventOccurrence[] (ocorrências virtuais) dentro de uma janela.
 *
 * Semântica de COUNT: EXDATE reduz o conjunto final mas as ocorrências excluídas ainda CONTAM
 * para COUNT. EXDATE date-only exclui o dia inteiro e é repassado ao engine; datetime
 * exclui somente o início exato depois da expansão. Valores UTC/offset são projetados na
 * timezone do mestre (UTC quando ausente), e RDATE timed preserva a própria hora.
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
import { parseRRule, validateRRuleModel } from './parser.js';

type PlainDate = InstanceType<TemporalLike['PlainDate']>;
const OFFSET_PATTERN = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/** Fold chooses the earlier instant; gap is detected by round-trip wall-clock. */
function zonedStart(temporal: TemporalLike, iso: string, timeZone?: string) {
  return temporal.PlainDateTime.from(iso).toZonedDateTime(timeZone ?? 'UTC', { disambiguation: 'compatible' });
}

function isNonexistentStart(temporal: TemporalLike, iso: string, timeZone?: string): boolean {
  if (!timeZone || timeZone === 'UTC') return false;
  const plain = temporal.PlainDateTime.from(iso);
  return temporal.PlainDateTime.compare(plain, zonedStart(temporal, iso, timeZone).toPlainDateTime()) !== 0;
}

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

/** Valores UTC/offset são projetados na zona do mestre; valores sem offset são wall-clock. */
function localDateTime(temporal: TemporalLike, iso: string, timeZone?: string) {
  const hasOffset = OFFSET_PATTERN.test(iso);
  return hasOffset
    ? temporal.Instant.from(iso).toZonedDateTimeISO(timeZone ?? 'UTC').toPlainDateTime()
    : temporal.PlainDateTime.from(iso);
}

function extraOccurrenceTimes(temporal: TemporalLike, shape: TimeShape, iso: string) {
  const isTimedValue = !shape.allDay && iso.length > 10;
  if (!isTimedValue) return occurrenceTimes(temporal, shape, temporal.PlainDate.from(iso.slice(0, 10)));
  const start = localDateTime(temporal, iso, shape.timeZone);
  const isGap = isNonexistentStart(temporal, start.toString(), shape.timeZone);
  if (isGap) throw new RangeError('[meucalendario] RDATE contém horário local inexistente na timezone do evento');
  const hasUnrepresentableFold = OFFSET_PATTERN.test(iso) && temporal.Instant.compare(
    temporal.Instant.from(iso), zonedStart(temporal, start.toString(), shape.timeZone).toInstant()) !== 0;
  if (hasUnrepresentableFold) throw new RangeError('[meucalendario] RDATE no segundo instante de horário repetido não pode ser representado pelo contrato wall-clock');
  const end = start.add(shape.durationForTimed!);
  return {
    start: { dateTime: start.toString(), ...(shape.timeZone ? { timeZone: shape.timeZone } : {}) },
    end: { dateTime: end.toString(), ...(shape.timeZone ? { timeZone: shape.timeZone } : {}) },
    originalStart: start.toString(),
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
 * Regras infinitas exigem `window.end`; regras finitas podem usar COUNT/UNTIL.
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
  const hasRule = !!event.recurrence?.rule;
  const hasRDates = (event.recurrence?.rDates?.length ?? 0) > 0;
  const isRecurring = hasRule || hasRDates;
  if (!isRecurring) {
    const baseDate = startPlainDate(temporal, event);
    const beforeWindow = windowStart !== undefined && temporal.PlainDate.compare(baseDate, windowStart) < 0;
    const afterWindow = windowEnd !== undefined && temporal.PlainDate.compare(baseDate, windowEnd) > 0;
    if (beforeWindow || afterWindow) return [];
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

  // isRecurring garante recurrence definido aqui.
  const recurrence = event.recurrence!;
  const model = ruleModel(recurrence);
  if (model) validateRRuleModel(model);
  const isUnbounded = model !== null && windowEnd === undefined && model.until === undefined &&
    (model.count === undefined || !Number.isFinite(model.count));
  if (isUnbounded) throw new Error('[meucalendario] expandEvent exige window.end, COUNT ou UNTIL para uma recorrência infinita.');
  const timedUntil = !shape.allDay && model?.until && model.until.length > 10
    ? localDateTime(temporal, model.until, shape.timeZone)
    : null;
  const untilInstant = !shape.allDay && model?.until && OFFSET_PATTERN.test(model.until)
    ? temporal.Instant.from(model.until) : null;
  const pastUntil = (originalStart: string): boolean => {
    if (untilInstant) return temporal.Instant.compare(zonedStart(temporal, originalStart, shape.timeZone).toInstant(), untilInstant) > 0;
    return timedUntil !== null && temporal.PlainDateTime.compare(temporal.PlainDateTime.from(originalStart), timedUntil) > 0;
  };
  const expansionModel = model && timedUntil ? { ...model, until: timedUntil.toPlainDate().toString() } : model;
  const dtStart = startPlainDate(temporal, event);

  const excludedDates = new Set<string>((recurrence.exDates ?? []).filter((iso) => iso.length <= 10).map((iso) => iso.slice(0, 10)));
  const excludedInstants = new Set<string>((recurrence.exDates ?? []).filter((iso) => !shape.allDay && OFFSET_PATTERN.test(iso))
    .map((iso) => temporal.Instant.from(iso).toString()));
  const excludedStarts = new Set<string>((recurrence.exDates ?? []).filter((iso) => iso.length > 10 && (shape.allDay || !OFFSET_PATTERN.test(iso)))
    .map((iso) => shape.allDay ? iso.slice(0, 10) : localDateTime(temporal, iso, shape.timeZone).toString()));

  const dates: PlainDate[] = [];
  if (model) {
    const expandOptions: ExpandOptions = {};
    const countsTimedStarts = !shape.allDay && model.count !== undefined;
    if (windowStart && !countsTimedStarts) expandOptions.windowStart = windowStart;
    if (windowEnd) expandOptions.windowEnd = windowEnd;
    // RFC gap starts do not consume COUNT; EXDATE does. Count valid timed starts
    // before removing exceptions, including those before the requested window.
    const iteratedModel = countsTimedStarts ? { ...expansionModel!, count: undefined } : expansionModel!;
    let validTimedStarts = 0;
    for (const date of expandRule(temporal, iteratedModel, dtStart, shape.allDay ? excludedDates : new Set(), expandOptions)) {
      const start = occurrenceTimes(temporal, shape, date).originalStart;
      const isGap = !shape.allDay && isNonexistentStart(temporal, start, shape.timeZone);
      if (isGap) continue;
      const beyondUntil = !shape.allDay && pastUntil(start);
      if (beyondUntil) break;
      validTimedStarts++;
      const withinWindow = !windowStart || temporal.PlainDate.compare(date, windowStart) >= 0;
      const excludedDate = excludedDates.has(date.toString());
      if (withinWindow && !excludedDate) dates.push(date);
      const reachedCount = countsTimedStarts && validTimedStarts >= model.count!;
      if (reachedCount) break;
    }
  }

  // RDATE: datas extras (não contam para COUNT). Respeita janela e EXDATE.
  const extraTimes: ReturnType<typeof occurrenceTimes>[] = [];
  for (const rDate of recurrence.rDates ?? []) {
    const times = extraOccurrenceTimes(temporal, shape, rDate);
    const plainDate = temporal.PlainDate.from(times.originalStart.slice(0, 10));
    const excluded = excludedDates.has(plainDate.toString());
    const beforeWindow = windowStart !== undefined && temporal.PlainDate.compare(plainDate, windowStart) < 0;
    const afterWindow = windowEnd !== undefined && temporal.PlainDate.compare(plainDate, windowEnd) > 0;
    const skip = excluded || beforeWindow || afterWindow;
    if (skip) continue;
    extraTimes.push(times);
  }

  // Um override pode mover uma ocorrência originalmente fora da janela para dentro dela.
  // Só admitimos chaves pertencentes à série (COUNT/UNTIL/filtros/EXDATE continuam valendo).
  for (const [originalStart, override] of Object.entries(recurrence.overrides ?? {})) {
    const hasMovedTime = !isCancelledOverride(override) && override.time !== undefined;
    if (!hasMovedTime) continue;
    const originalDate = temporal.PlainDate.from(originalStart.slice(0, 10));
    const originalISO = originalDate.toString();
    const alreadyIncluded = dates.some((date) => date.toString() === originalISO);
    if (alreadyIncluded || excludedDates.has(originalISO)) continue;
    const expectedStart = occurrenceTimes(temporal, shape, originalDate).originalStart;
    const matchingRDate = recurrence.rDates?.find((iso) => extraOccurrenceTimes(temporal, shape, iso).originalStart === originalStart);
    const validKey = originalStart === originalISO || originalStart === expectedStart || matchingRDate !== undefined;
    if (!validKey) continue;
    const movedEvent = { ...event, time: override.time! };
    const movedStart = startPlainDate(temporal, movedEvent);
    const movedEndISO = movedEvent.time.allDay ? movedEvent.time.end.date! : movedEvent.time.end.dateTime!;
    const movedEnd = temporal.PlainDate.from(movedEndISO.slice(0, 10));
    const beforeWindow = windowStart !== undefined && temporal.PlainDate.compare(movedEnd, windowStart) < 0;
    const afterWindow = windowEnd !== undefined && temporal.PlainDate.compare(movedStart, windowEnd) > 0;
    if (beforeWindow || afterWindow) continue;
    const isRDate = matchingRDate !== undefined || (recurrence.rDates?.some((date) => date === originalISO) ?? false);
    let isRuleDate = false;
    if (model && !isRDate) {
      if (!shape.allDay) {
        const unmodifiedSeries = { ...event, recurrence: { ...recurrence, overrides: undefined } };
        isRuleDate = expandEvent(temporal, unmodifiedSeries, { start: originalISO, end: originalISO })
          .some((candidate) => candidate.originalStart === expectedStart);
      } else {
        for (const candidate of expandRule(temporal, expansionModel!, dtStart, excludedDates, {
          windowStart: originalDate,
          windowEnd: originalDate,
        })) {
          isRuleDate = candidate.toString() === originalISO;
        }
      }
    }
    if (isRDate && matchingRDate) extraTimes.push(extraOccurrenceTimes(temporal, shape, matchingRDate));
    else if (isRDate || isRuleDate) dates.push(originalDate);
  }

  // dedup + sort
  const seenKeys = new Set<string>();
  const uniqueDates = dates
    .filter((date) => {
      const key = date.toString();
      const alreadySeen = seenKeys.has(key);
      if (alreadySeen) return false;
      seenKeys.add(key);
      return true;
    })
    .sort((left, right) => temporal.PlainDate.compare(left, right));

  const results: EventOccurrence[] = [];
  const ruleTimes = uniqueDates.map((date) => occurrenceTimes(temporal, shape, date)).filter((times) => {
    const pastTimedUntil = !shape.allDay && pastUntil(times.originalStart);
    return !pastTimedUntil;
  });
  const uniqueTimes = new Map([...ruleTimes, ...extraTimes].map((times) => [times.originalStart, times]));
  for (const times of [...uniqueTimes.values()].sort((left, right) => left.originalStart.localeCompare(right.originalStart))) {
    if (excludedStarts.has(times.originalStart)) continue;
    const excludedInstant = !shape.allDay && excludedInstants.has(zonedStart(temporal, times.originalStart, shape.timeZone).toInstant().toString());
    if (excludedInstant) continue;
    const occurrenceEvent: CalendarEvent = {
      ...event,
      time: { allDay: shape.allDay, start: times.start, end: times.end },
    };
    const effectiveEvent = applyOverride(occurrenceEvent, recurrence, times.originalStart);
    const isCancelled = effectiveEvent === null;
    if (isCancelled) continue;
    const isMaster = times.originalStart === occurrenceTimes(temporal, shape, dtStart).originalStart;
    results.push({
      event: effectiveEvent,
      masterId: event.id,
      originalStart: times.originalStart,
      isMaster,
    });
  }
  return results;
}
