import type { CalendarEvent, EventOccurrence, Recurrence, RRuleModel } from '../types/index.js';
import { isCancelledOverride } from '../types/index.js';
import type { TemporalLike } from '../date/temporal.js';
import { ruleStarts } from './ruleStarts.js';
import { parseRRule, validateRRuleModel } from './parser.js';

type PlainDate = InstanceType<TemporalLike['PlainDate']>;
const OFFSET_PATTERN = /(?:Z|[+-]\d{2}:?\d{2})$/i;

interface LocalStartInput {
  /** Resolved Temporal implementation. @remarks Português: Implementação Temporal resolvida. */
  temporal: TemporalLike;
  /** Local or offset date-time, according to the caller. @remarks Português: Data e hora local ou com offset, conforme o chamador. */
  iso: string;
  /** Event time zone; omitted uses UTC. @remarks Português: Fuso do evento; ausente usa UTC. */
  timeZone?: string | undefined;
}

/** Resolve a local start using compatible DST disambiguation. @remarks Português: Resolve início local com desambiguação compatível de horário de verão. */
function zonedStart({ temporal, iso, timeZone }: LocalStartInput) {
  return temporal.PlainDateTime.from(iso).toZonedDateTime(timeZone ?? 'UTC', {
    disambiguation: 'compatible',
  });
}

/** Detect skipped local times during a zone transition. @remarks Português: Detecta horários locais inexistentes durante mudança de fuso. */
function isNonexistentStart({ temporal, iso, timeZone }: LocalStartInput): boolean {
  if (!timeZone || timeZone === 'UTC') return false;
  const plain = temporal.PlainDateTime.from(iso);
  return (
    temporal.PlainDateTime.compare(
      plain,
      zonedStart({ temporal, iso, timeZone }).toPlainDateTime(),
    ) !== 0
  );
}

/** Inclusive ISO date bounds for occurrence expansion.
 * @remarks Português: Limites inclusivos de datas ISO para expansão de ocorrências.
 */
export interface ExpandWindow {
  /** Inclusive first ISO date; omitted uses the series anchor.
   * @remarks Português: Primeira data ISO inclusiva; ausente usa a âncora da série.
   */
  start?: string;

  /** Inclusive last ISO date; required to bound infinite rules.
   * @remarks Português: Última data ISO inclusiva; necessária para limitar regras infinitas.
   */
  end?: string;
}

function ruleModel(recurrence: Recurrence): RRuleModel | null {
  if (!recurrence.rule) return null;
  return typeof recurrence.rule === 'string' ? parseRRule(recurrence.rule) : recurrence.rule;
}

function startPlainDate({
  temporal,
  event,
}: {
  /** Injected date/time implementation. / PT: Implementação de datas e horários injetada. */
  temporal: TemporalLike; /** Master event defining the local start and duration. / PT: Evento principal que define início e duração locais. */
  event: CalendarEvent;
}): PlainDate {
  const start = event.time.start;
  const isoString = event.time.allDay ? start.date : start.dateTime;
  if (!isoString) throw new Error(`[calendara] evento ${event.id} sem start válido`);
  return temporal.PlainDate.from(isoString.slice(0, 10));
}

interface TimeShape {
  /** Date-only event. @remarks Português: Evento definido por datas. */
  allDay: boolean;

  /** Master local time, or null for all-day events. @remarks Português: Horário local principal, ou null em eventos de dia inteiro. */
  startTime: string | null;

  /** All-day duration in whole days. @remarks Português: Duração de dia inteiro em dias completos. */
  durationDaysAllDay: number;

  /** Wall-clock duration for timed events. @remarks Português: Duração local de eventos com horário. */
  durationForTimed: ReturnType<InstanceType<TemporalLike['PlainDateTime']>['since']> | null;
  /** Master event time zone. @remarks Português: Fuso horário do evento principal. */
  timeZone: string | undefined;
}

function timeShape({
  temporal,
  event,
}: {
  /** Injected date/time implementation. / PT: Implementação de datas e horários injetada. */
  temporal: TemporalLike; /** Master event defining the local start and duration. / PT: Evento principal que define início e duração locais. */
  event: CalendarEvent;
}): TimeShape {
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

/** Preserve series duration on a recurrence date. @remarks Português: Preserva duração da série na data de recorrência. */
function occurrenceTimes({
  temporal,
  shape,
  date,
}: {
  /** Resolved Temporal implementation. @remarks Português: Implementação Temporal resolvida. */
  temporal: TemporalLike;
  /** Master duration and local start time. @remarks Português: Duração e horário local inicial do evento principal. */
  shape: TimeShape;
  /** Occurrence local date. @remarks Português: Data local da ocorrência. */
  date: PlainDate;
}): {
  /** Inclusive occurrence start. @remarks Português: Início inclusivo da ocorrência. */
  start: CalendarEvent['time']['start'];
  /** Exclusive occurrence end. @remarks Português: Fim exclusivo da ocorrência. */
  end: CalendarEvent['time']['end'];
  /** Stable occurrence start before overrides. @remarks Português: Início estável da ocorrência antes das exceções. */
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
    end: {
      dateTime: endDateTime.toString(),
      ...(shape.timeZone ? { timeZone: shape.timeZone } : {}),
    },
    originalStart: startIso,
  };
}

/** Normalize offset values into the event local time. @remarks Português: Converte valores com offset para horário local do evento. */
function localDateTime({ temporal, iso, timeZone }: LocalStartInput) {
  const hasOffset = OFFSET_PATTERN.test(iso);
  return hasOffset
    ? temporal.Instant.from(iso)
        .toZonedDateTimeISO(timeZone ?? 'UTC')
        .toPlainDateTime()
    : temporal.PlainDateTime.from(iso);
}

/** Resolve an RDATE while preserving duration and rejecting unsupported DST times. @remarks Português: Resolve RDATE preservando duração e rejeitando horários de verão não suportados. */
function extraOccurrenceTimes({
  temporal,
  shape,
  iso,
}: {
  /** Resolved Temporal implementation. @remarks Português: Implementação Temporal resolvida. */
  temporal: TemporalLike;
  /** Master duration and local start time. @remarks Português: Duração e horário local inicial do evento principal. */
  shape: TimeShape;
  /** Additional date or date-time from RDATE. @remarks Português: Data ou horário adicional de RDATE. */
  iso: string;
}) {
  const isTimedValue = !shape.allDay && iso.length > 10;
  if (!isTimedValue)
    return occurrenceTimes({
      temporal,
      shape,
      date: temporal.PlainDate.from(iso.slice(0, 10)),
    });
  const start = localDateTime({ temporal, iso, timeZone: shape.timeZone });
  const isGap = isNonexistentStart({
    temporal,
    iso: start.toString(),
    timeZone: shape.timeZone,
  });
  if (isGap)
    throw new RangeError(
      '[calendara] RDATE contém horário local inexistente na timezone do evento',
    );
  const hasUnrepresentableFold =
    OFFSET_PATTERN.test(iso) &&
    temporal.Instant.compare(
      temporal.Instant.from(iso),
      zonedStart({
        temporal,
        iso: start.toString(),
        timeZone: shape.timeZone,
      }).toInstant(),
    ) !== 0;
  if (hasUnrepresentableFold)
    throw new RangeError(
      '[calendara] RDATE no segundo instante de horário repetido não pode ser representado pelo contrato wall-clock',
    );
  const end = start.add(shape.durationForTimed!);
  return {
    start: { dateTime: start.toString(), ...(shape.timeZone ? { timeZone: shape.timeZone } : {}) },
    end: { dateTime: end.toString(), ...(shape.timeZone ? { timeZone: shape.timeZone } : {}) },
    originalStart: start.toString(),
  };
}

/** Apply an occurrence override, preserving its original identity. @remarks Português: Aplica exceção da ocorrência preservando sua identidade original. */
function applyOverride({
  baseEvent,
  recurrence,
  originalStart,
}: {
  /** Occurrence before overrides. @remarks Português: Ocorrência antes das exceções. */
  baseEvent: CalendarEvent;
  /** Series exceptions. @remarks Português: Exceções da série. */
  recurrence: Recurrence;
  /** Original start identifying this occurrence. @remarks Português: Início original que identifica esta ocorrência. */
  originalStart: string;
}): CalendarEvent | null {
  const override =
    recurrence.overrides?.[originalStart] ?? recurrence.overrides?.[originalStart.slice(0, 10)];
  if (!override) return baseEvent;
  if (isCancelledOverride(override)) return null;
  return { ...baseEvent, ...override, time: override.time ?? baseEvent.time };
}

/** Named input for recurrence expansion. @remarks Português: Parâmetros nomeados da expansão de recorrências. */
export interface ExpandEventInput {
  /** Resolved Temporal implementation. @remarks Português: Implementação Temporal resolvida. */
  temporal: TemporalLike;
  /** Master event to expand. @remarks Português: Evento principal a expandir. */
  event: CalendarEvent;
  /** Inclusive date bounds; defaults to an empty window. @remarks Português: Limites inclusivos de datas; padrão é janela vazia. */
  window?: ExpandWindow;
}

/** Expand event occurrences; unbounded rules require window.end and exclusions retain COUNT.
 * @remarks Português: Expande ocorrências; regras infinitas exigem window.end e exclusões preservam COUNT.
 */
export function expandEvent({ temporal, event, window = {} }: ExpandEventInput): EventOccurrence[] {
  const shape = timeShape({ temporal, event });
  const windowStart = window.start ? temporal.PlainDate.from(window.start) : undefined;
  const windowEnd = window.end ? temporal.PlainDate.from(window.end) : undefined;

  const hasRule = !!event.recurrence?.rule;
  const hasRDates = (event.recurrence?.rDates?.length ?? 0) > 0;
  const isRecurring = hasRule || hasRDates;
  if (!isRecurring) {
    const baseDate = startPlainDate({ temporal, event });
    const beforeWindow =
      windowStart !== undefined && temporal.PlainDate.compare(baseDate, windowStart) < 0;
    const afterWindow =
      windowEnd !== undefined && temporal.PlainDate.compare(baseDate, windowEnd) > 0;
    if (beforeWindow || afterWindow) return [];
    const times = occurrenceTimes({ temporal, shape, date: baseDate });
    return [
      {
        event: { ...event, time: { allDay: shape.allDay, start: times.start, end: times.end } },
        masterId: event.id,
        originalStart: times.originalStart,
        isMaster: true,
      },
    ];
  }

  const recurrence = event.recurrence!;
  const model = ruleModel(recurrence);
  if (model) validateRRuleModel(model);
  const isUnbounded =
    model !== null &&
    windowEnd === undefined &&
    model.until === undefined &&
    (model.count === undefined || !Number.isFinite(model.count));
  if (isUnbounded)
    throw new Error(
      '[calendara] expandEvent exige window.end, COUNT ou UNTIL para uma recorrência infinita.',
    );
  const dtStart = startPlainDate({ temporal, event });
  const masterStart = occurrenceTimes({
    temporal,
    shape,
    date: dtStart,
  }).originalStart;

  const excludedDates = new Set<string>(
    (recurrence.exDates ?? []).filter((iso) => iso.length <= 10).map((iso) => iso.slice(0, 10)),
  );
  const excludedInstants = new Set<string>(
    (recurrence.exDates ?? [])
      .filter((iso) => !shape.allDay && OFFSET_PATTERN.test(iso))
      .map((iso) => temporal.Instant.from(iso).toString()),
  );
  const excludedStarts = new Set<string>(
    (recurrence.exDates ?? [])
      .filter((iso) => iso.length > 10 && (shape.allDay || !OFFSET_PATTERN.test(iso)))
      .map((iso) =>
        shape.allDay
          ? iso.slice(0, 10)
          : localDateTime({ temporal, iso, timeZone: shape.timeZone }).toString(),
      ),
  );

  const timesForRuleStart = (originalStart: string): ReturnType<typeof occurrenceTimes> => {
    if (shape.allDay)
      return occurrenceTimes({
        temporal,
        shape,
        date: temporal.PlainDate.from(originalStart),
      });
    const start = temporal.PlainDateTime.from(originalStart);
    const zone = shape.timeZone ? { timeZone: shape.timeZone } : {};
    return {
      originalStart,
      start: { dateTime: originalStart, ...zone },
      end: { dateTime: start.add(shape.durationForTimed!).toString(), ...zone },
    };
  };
  const ruleTimes = (model ? ruleStarts({ temporal, event, model, window }) : [])
    .filter((start) => !excludedDates.has(start.slice(0, 10)))
    .map(timesForRuleStart);

  const extraTimes: ReturnType<typeof occurrenceTimes>[] = [];
  for (const rDate of recurrence.rDates ?? []) {
    const times = extraOccurrenceTimes({ temporal, shape, iso: rDate });
    const plainDate = temporal.PlainDate.from(times.originalStart.slice(0, 10));
    const excluded = excludedDates.has(plainDate.toString());
    const beforeWindow =
      windowStart !== undefined && temporal.PlainDate.compare(plainDate, windowStart) < 0;
    const afterWindow =
      windowEnd !== undefined && temporal.PlainDate.compare(plainDate, windowEnd) > 0;
    const skip = excluded || beforeWindow || afterWindow;
    if (skip) continue;
    extraTimes.push(times);
  }

  for (const [originalStart, override] of Object.entries(recurrence.overrides ?? {})) {
    const hasMovedTime = !isCancelledOverride(override) && override.time !== undefined;
    if (!hasMovedTime) continue;
    const originalDate = temporal.PlainDate.from(originalStart.slice(0, 10));
    const originalISO = originalDate.toString();
    const expectedStart = occurrenceTimes({
      temporal,
      shape,
      date: originalDate,
    }).originalStart;
    const alreadyIncluded = ruleTimes.some(
      (times) =>
        times.originalStart === originalStart ||
        (originalStart === originalISO && times.originalStart === expectedStart),
    );
    if (alreadyIncluded || excludedDates.has(originalISO)) continue;
    const matchingRDate = recurrence.rDates?.find(
      (iso) => extraOccurrenceTimes({ temporal, shape, iso }).originalStart === originalStart,
    );
    const validKey =
      originalStart === originalISO ||
      originalStart === expectedStart ||
      matchingRDate !== undefined;
    if (!validKey) continue;
    const movedEvent = { ...event, time: override.time! };
    const movedStart = startPlainDate({ temporal, event: movedEvent });
    const movedEndISO = movedEvent.time.allDay
      ? movedEvent.time.end.date!
      : movedEvent.time.end.dateTime!;
    const movedEnd = temporal.PlainDate.from(movedEndISO.slice(0, 10));
    const beforeWindow =
      windowStart !== undefined && temporal.PlainDate.compare(movedEnd, windowStart) < 0;
    const afterWindow =
      windowEnd !== undefined && temporal.PlainDate.compare(movedStart, windowEnd) > 0;
    if (beforeWindow || afterWindow) continue;
    const isRDate =
      matchingRDate !== undefined ||
      (recurrence.rDates?.some((date) => date === originalISO) ?? false);
    let isRuleDate = false;
    if (model && !isRDate) {
      if (!shape.allDay) {
        const unmodifiedSeries = { ...event, recurrence: { ...recurrence, overrides: undefined } };
        isRuleDate = expandEvent({
          temporal,
          event: unmodifiedSeries,
          window: {
            start: originalISO,
            end: originalISO,
          },
        }).some((candidate) => candidate.originalStart === expectedStart);
      } else
        isRuleDate = ruleStarts({
          temporal,
          event,
          model,
          window: { start: originalISO, end: originalISO },
        }).includes(originalISO);
    }
    if (isRDate && matchingRDate)
      extraTimes.push(extraOccurrenceTimes({ temporal, shape, iso: matchingRDate }));
    else if (isRDate || isRuleDate)
      ruleTimes.push(occurrenceTimes({ temporal, shape, date: originalDate }));
  }

  const results: EventOccurrence[] = [];
  const uniqueTimes = new Map(
    [...ruleTimes, ...extraTimes].map((times) => [times.originalStart, times]),
  );
  for (const times of [...uniqueTimes.values()].sort((left, right) =>
    left.originalStart.localeCompare(right.originalStart),
  )) {
    if (excludedStarts.has(times.originalStart)) continue;
    const excludedInstant =
      !shape.allDay &&
      excludedInstants.size > 0 &&
      excludedInstants.has(
        zonedStart({ temporal, iso: times.originalStart, timeZone: shape.timeZone })
          .toInstant()
          .toString(),
      );
    if (excludedInstant) continue;
    const occurrenceEvent: CalendarEvent = {
      ...event,
      time: { allDay: shape.allDay, start: times.start, end: times.end },
    };
    const effectiveEvent = applyOverride({
      baseEvent: occurrenceEvent,
      recurrence,
      originalStart: times.originalStart,
    });
    const isCancelled = effectiveEvent === null;
    if (isCancelled) continue;
    const isMaster = times.originalStart === masterStart;
    results.push({
      event: effectiveEvent,
      masterId: event.id,
      originalStart: times.originalStart,
      isMaster,
    });
  }
  return results;
}
