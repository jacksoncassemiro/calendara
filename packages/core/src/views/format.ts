/**
 * Formatação de datas determinística via Intl sobre um Date UTC construído a partir do
 * PlainDate (evita quirks de locale do polyfill Temporal e é estável em teste).
 */
import type { TemporalLike } from '../date/temporal.js';

type PlainDate = InstanceType<TemporalLike['PlainDate']>;

function utcDate(d: PlainDate): Date {
  return new Date(Date.UTC(d.year, d.month - 1, d.day));
}

export function formatDate(
  d: PlainDate,
  locale: string,
  opts: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, { ...opts, timeZone: 'UTC' }).format(utcDate(d));
}

/** Rótulo de hora 'HH:mm' a partir de minutos-do-dia. */
export function formatHourLabel(min: number, locale: string): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const base = new Date(Date.UTC(2000, 0, 1, h, m));
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(base);
}
