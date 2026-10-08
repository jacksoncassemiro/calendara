import type { TemporalLike } from '../date/temporal.js';
import type { CalendarEvent, OccurrenceOverride, Recurrence } from '../types/index.js';
import { isCancelledOverride } from '../types/index.js';
import { parseRRule } from './parser.js';
import { expandEvent } from './recurrenceSet.js';
import { ruleStarts } from './ruleStarts.js';

export interface SplitSeriesResult {
  /** Replace the old master, or remove it when the cut is its first occurrence. */
  before: CalendarEvent | null;
  /** Persist as a new master with a caller-provided unique id. */
  following: CalendarEvent;
}

/** Split at a generated RRULE start, counting EXDATE/cancellations before the cut.
 * RDATE-only cuts and changes between all-day/timed are rejected explicitly.
 * Future exceptions/overrides move by the wall-clock offset of the new anchor.
 */
export function splitEventSeries(
  temporal: TemporalLike,
  event: CalendarEvent,
  originalStart: string,
  newId: string,
  changes: Partial<Omit<CalendarEvent, 'id' | 'recurrence'>> = {},
): SplitSeriesResult {
  if (!newId || newId === event.id)
    throw new RangeError('[meucalendario] nova série exige um id diferente');
  const recurrence = event.recurrence;
  if (!recurrence?.rule) throw new RangeError('[meucalendario] esta e seguintes exige uma RRULE');
  const model = typeof recurrence.rule === 'string' ? parseRRule(recurrence.rule) : recurrence.rule;
  const allDay = event.time.allDay;
  const zone = event.time.start.timeZone ?? 'UTC';
  const normalize = (value: string) =>
    allDay || value.length === 10
      ? temporal.PlainDate.from(value.slice(0, 10)).toString()
      : /(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
        ? temporal.Instant.from(value).toZonedDateTimeISO(zone).toPlainDateTime().toString()
        : temporal.PlainDateTime.from(value).toString();
  const cut = normalize(originalStart),
    cutDate = cut.slice(0, 10);
  const starts = ruleStarts({ temporal, event, model, window: { end: cutDate } });
  const precedingCount = starts.indexOf(cut);
  if (
    precedingCount < 0 ||
    !expandEvent(temporal, event, { start: cutDate, end: cutDate }).some(
      (item) => item.originalStart === cut,
    )
  ) {
    throw new RangeError('[meucalendario] corte deve pertencer a uma ocorrência ativa da RRULE');
  }
  const cutPlain = temporal.PlainDate.from(cutDate);
  const sourceStart = allDay ? event.time.start.date! : event.time.start.dateTime!;
  const sourceEnd = allDay ? event.time.end.date! : event.time.end.dateTime!;
  const cutTime: CalendarEvent['time'] = allDay
    ? {
        allDay: true,
        start: { ...event.time.start, date: cut },
        end: {
          ...event.time.end,
          date: cutPlain
            .add(temporal.PlainDate.from(sourceEnd).since(temporal.PlainDate.from(sourceStart)))
            .toString(),
        },
      }
    : {
        allDay: false,
        start: { ...event.time.start, dateTime: cut },
        end: {
          ...event.time.end,
          dateTime: temporal.PlainDateTime.from(cut)
            .add(
              temporal.PlainDateTime.from(sourceEnd).since(
                temporal.PlainDateTime.from(sourceStart),
              ),
            )
            .toString(),
        },
      };
  const nextTime = changes.time ?? cutTime;
  if (nextTime.allDay !== allDay)
    throw new RangeError(
      '[meucalendario] esta e seguintes não converte a série entre dia inteiro e horário',
    );
  if (!allDay && (nextTime.start.timeZone ?? 'UTC') !== zone)
    throw new RangeError('[meucalendario] esta e seguintes preserva a timezone da série');
  const nextStart = allDay ? nextTime.start.date! : nextTime.start.dateTime!;
  const delta = allDay
    ? temporal.PlainDate.from(nextStart).since(cutPlain)
    : temporal.PlainDateTime.from(nextStart).since(temporal.PlainDateTime.from(cut));
  const shift = (value: string): string => {
    const local = normalize(value);
    return local.length === 10
      ? temporal.PlainDate.from(local).add({ days: delta.days }).toString()
      : temporal.PlainDateTime.from(local).add(delta).toString();
  };
  const shiftTime = (time: CalendarEvent['time']): CalendarEvent['time'] => {
    if (time.allDay !== allDay)
      throw new RangeError(
        '[meucalendario] override com outro tipo de horário exige edição separada',
      );
    return time.allDay
      ? {
          ...time,
          start: { ...time.start, date: shift(time.start.date!) },
          end: { ...time.end, date: shift(time.end.date!) },
        }
      : {
          ...time,
          start: { ...time.start, dateTime: shift(time.start.dateTime!) },
          end: { ...time.end, dateTime: shift(time.end.dateTime!) },
        };
  };
  const beforeCut = (value: string) =>
    normalize(value).length === 10 ? normalize(value) < cutDate : normalize(value) < cut;
  const partition = (values: string[] | undefined, before: boolean) =>
    values
      ?.filter((value) => beforeCut(value) === before)
      .map((value) => (before ? value : shift(value)));
  const overrides = (before: boolean) =>
    Object.fromEntries(
      Object.entries(recurrence.overrides ?? {})
        .filter(([key]) => beforeCut(key) === before)
        .map(([key, override]): [string, OccurrenceOverride] => {
          if (before || isCancelledOverride(override)) return [before ? key : shift(key), override];
          const nextOverride = {
            ...override,
            ...(override.id === event.id ? { id: newId } : {}),
            ...(override.time ? { time: shiftTime(override.time) } : {}),
          };
          if (normalize(key) === cut)
            for (const field of Object.keys(changes))
              delete nextOverride[field as keyof typeof nextOverride];
          return [shift(key), nextOverride];
        }),
    );
  const followingRule = {
    ...model,
    ...(model.until ? { until: shift(model.until) } : {}),
    ...(model.count !== undefined ? { count: model.count - precedingCount } : {}),
  };
  const following: CalendarEvent = {
    ...event,
    ...changes,
    id: newId,
    time: nextTime,
    recurrence: {
      rule: followingRule,
      rDates: partition(recurrence.rDates, false),
      exDates: partition(recurrence.exDates, false),
      overrides: overrides(false),
    },
  };
  const nextKey = allDay
    ? temporal.PlainDate.from(nextStart).toString()
    : temporal.PlainDateTime.from(nextStart).toString();
  if (
    !ruleStarts({
      temporal,
      event: following,
      model: followingRule,
      window: { start: nextKey.slice(0, 10), end: nextKey.slice(0, 10) },
    }).includes(nextKey)
  ) {
    throw new RangeError(
      '[meucalendario] novo início não combina com os filtros ou limite da regra',
    );
  }
  const previousRecurrence: Recurrence = {
    rDates: partition(recurrence.rDates, true),
    exDates: partition(recurrence.exDates, true),
    overrides: overrides(true),
  };
  if (precedingCount > 0)
    previousRecurrence.rule = { ...model, count: precedingCount, until: undefined };
  return {
    before:
      precedingCount > 0 || previousRecurrence.rDates?.length
        ? { ...event, recurrence: previousRecurrence }
        : null,
    following,
  };
}
