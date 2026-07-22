/**
 * Formatação de datas determinística via Intl sobre um Date UTC construído a partir do
 * PlainDate (evita quirks de locale do polyfill Temporal e é estável em teste).
 */
import type { TemporalLike } from '../date/temporal.js';

type PlainDate = InstanceType<TemporalLike['PlainDate']>;

function toUtcDate(date: PlainDate): Date {
  return new Date(Date.UTC(date.year, date.month - 1, date.day));
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
    hour12: false,
    timeZone: 'UTC',
  }).format(baseDate);
}
