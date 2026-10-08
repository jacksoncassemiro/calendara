/**
 * Formatação de datas determinística via Intl sobre um Date UTC construído a partir do
 * PlainDate (evita quirks de locale do polyfill Temporal e é estável em teste).
 */
import type { TemporalLike } from '../../core/index.js';
import type { CalendarOptions } from '../../core/index.js';
import type { InteractionDraft } from '../../core/index.js';
import { normalizeCalendarMinute, shiftCalendarDate } from '../../core/interaction/model.js';

/** Formats the complete candidate interval, never the clipped render segment. */
export function formatDraftInterval(
  draft: Pick<InteractionDraft,'dateISO'|'startMin'|'endMin'|'endDateISO'|'allDay'>,
  locale = 'pt-BR',
): string {
  const dateLabel = (iso:string) => {
    const [year,month,day]=iso.split('-').map(Number);
    const date=new Date(0);date.setUTCFullYear(year!,month!-1,day!);date.setUTCHours(0,0,0,0);
    return new Intl.DateTimeFormat(locale,{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}).format(date);
  };
  if(draft.allDay){
    const first=draft.dateISO,last=shiftCalendarDate(draft.endDateISO ?? shiftCalendarDate(first,1),-1);
    const label=new Intl.Locale(locale).language==='pt' ? 'Dia inteiro' : 'All day';
    return `${label} · ${dateLabel(first)}${last!==first ? `–${dateLabel(last)}` : ''}`;
  }
  const first=normalizeCalendarMinute(draft.dateISO,draft.startMin);
  const last=normalizeCalendarMinute(draft.endDateISO ?? draft.dateISO,draft.endMin);
  const firstTime=formatHourLabel(first.minute,locale),lastTime=formatHourLabel(last.minute,locale);
  return first.dateISO===last.dateISO ? `${firstTime}–${lastTime}`
    : `${dateLabel(first.dateISO)} ${firstTime}–${dateLabel(last.dateISO)} ${lastTime}`;
}

export function timeLabelStep(options: CalendarOptions, horizontal=false): number {
  if (options.timeLabelInterval !== undefined) return options.timeLabelInterval;
  const interval = options.slotMinutes;
  // Only automatic labels adapt; explicit intervals and selection slots stay unchanged.
  return Math.max(interval, Math.ceil((horizontal ? 60 : 24) / options.pxPerMinute / interval) * interval);
}

type PlainDate = InstanceType<TemporalLike['PlainDate']>;

function toUtcDate(date: PlainDate): Date {
  const result = new Date(0);
  result.setUTCFullYear(date.year, date.month - 1, date.day);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

export function formatDate(
  date: PlainDate,
  locale: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(toUtcDate(date));
}

/** Rótulo de hora 'HH:mm' a partir de minutos-do-dia. */
export function formatHourLabel(minuteOfDay: number, locale: string): string {
  const hours = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;
  const baseDate = new Date(Date.UTC(2000, 0, 1, hours, minutes));
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'UTC',
  }).format(baseDate);
}
