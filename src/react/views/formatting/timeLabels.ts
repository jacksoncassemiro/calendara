/** Civil-date and interval labels. @remarks Português: Rótulos de datas civis e intervalos. */
import type { TemporalLike } from '../../../core/index.js';
import type { CalendarOptions } from '../../../core/index.js';
import type { InteractionDraft } from '../../../core/index.js';
import { normalizeCalendarMinute, shiftCalendarDate } from '../../../core/interaction/model.js';

/** Format the full preview interval. @remarks Português: Formata o intervalo completo da prévia. */
export function formatDraftInterval({
  draft,
  locale = 'pt-BR',
}: {
  /** Full gesture interval before clipping. @remarks Português: Intervalo completo do gesto antes do recorte. */
  draft: Pick<InteractionDraft, 'dateISO' | 'startMin' | 'endMin' | 'endDateISO' | 'allDay'>;
  /** Label locale; defaults to pt-BR. @remarks Português: Locale dos rótulos; padrão pt-BR. */
  locale?: string | undefined;
}): string {
  const dateLabel = (iso: string) => {
    const [year, month, day] = iso.split('-').map(Number);
    const date = new Date(0);
    date.setUTCFullYear(year!, month! - 1, day!);
    date.setUTCHours(0, 0, 0, 0);
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(date);
  };
  if (draft.allDay) {
    const first = draft.dateISO,
      last = shiftCalendarDate({
        dateISO: draft.endDateISO ?? shiftCalendarDate({ dateISO: first, days: 1 }),
        days: -1,
      });
    const label = new Intl.Locale(locale).language === 'pt' ? 'Dia inteiro' : 'All day';
    return `${label} · ${dateLabel(first)}${last !== first ? `–${dateLabel(last)}` : ''}`;
  }
  const first = normalizeCalendarMinute({ dateISO: draft.dateISO, minute: draft.startMin });
  const last = normalizeCalendarMinute({
    dateISO: draft.endDateISO ?? draft.dateISO,
    minute: draft.endMin,
  });
  const firstTime = formatHourLabel({ minuteOfDay: first.minute, locale }),
    lastTime = formatHourLabel({ minuteOfDay: last.minute, locale });
  return first.dateISO === last.dateISO
    ? `${firstTime}–${lastTime}`
    : `${dateLabel(first.dateISO)} ${firstTime}–${dateLabel(last.dateISO)} ${lastTime}`;
}

/** Resolve visible-label spacing in minutes. @remarks Português: Resolve espaçamento dos rótulos visíveis em minutos. */
export function timeLabelStep({
  options,
  horizontal = false,
}: {
  /** Resolved slot and scale configuration. @remarks Português: Configuração resolvida dos slots e da escala. */
  options: CalendarOptions;
  /** Use horizontal label clearance; defaults to false. @remarks Português: Usa espaço para rótulos horizontais; padrão false. */
  horizontal?: boolean;
}): number {
  if (options.timeLabelInterval !== undefined) return options.timeLabelInterval;
  const interval = options.slotMinutes;

  return Math.max(
    interval,
    Math.ceil((horizontal ? 60 : 24) / options.pxPerMinute / interval) * interval,
  );
}

type PlainDate = InstanceType<TemporalLike['PlainDate']>;

function toUtcDate(date: PlainDate): Date {
  const result = new Date(0);
  result.setUTCFullYear(date.year, date.month - 1, date.day);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

/** Civil date formatting inputs. @remarks Português: Entradas para formatar uma data civil. */
export interface DateFormatInput {
  /** Civil date. @remarks Português: Data civil. */
  date: PlainDate;
  /** Intl locale. @remarks Português: Locale Intl. */
  locale: string;
  /** Display fields; UTC is always used. @remarks Português: Campos exibidos; sempre usa UTC. */
  options: Intl.DateTimeFormatOptions;
}
/** Format without shifting the civil date. @remarks Português: Formata sem deslocar a data civil. */
export function formatDate({ date, locale, options }: DateFormatInput): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(toUtcDate(date));
}

/** Format a minute-of-day value as a clock label. @remarks Português: Formata minutos do dia como rótulo de horário. */
export function formatHourLabel({
  minuteOfDay,
  locale,
}: {
  /** Minutes since midnight. @remarks Português: Minutos desde meia-noite. */
  minuteOfDay: number;
  /** Intl label locale. @remarks Português: Locale Intl do rótulo. */
  locale: string;
}): string {
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
