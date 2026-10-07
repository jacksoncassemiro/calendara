/**
 * Tipos e defaults do estado de render do CalendarApp.
 * (Estado puro de dados — o Preact é apenas o desenhador.)
 */
import type { WeekdayCode } from '../types/datetime.js';
import type { CalendarEvent } from '../types/event.js';
import type { ConstraintSet } from '../types/constraint.js';
import { hhmmToMinutes } from '../date/time.js';

/**
 * Hora do grid: um número (hora inteira, ex.: `7`) OU uma string de horário `'HH:mm'` ou
 * `'HH:mm:ss'` (ex.: `'07:30'` ou `'07:30:00'`, formato do FullCalendar `slotMinTime`). Os segundos
 * são ignorados. Para o dia inteiro use `0`/`24` ou `'00:00'`/`'24:00'`. Resolvido por `resolveHour`.
 */
export type GridHour = number | string;

/** Converte `GridHour` para horas (fracionárias): `7`→7, `'07:30'`→7.5, `'07:30:00'`→7.5. */
export function resolveHour(value: GridHour): number {
  return typeof value === 'string' ? hhmmToMinutes(value) / 60 : value;
}

/** Opções visuais/comportamentais. Escala de horário é dinâmica (startHour/endHour/slotMinutes). */
export interface CalendarOptions {
  locale: string;
  /** Primeiro dia da semana (afeta a view Week). */
  weekStart: WeekdayCode;
  /** Topo do grid: hora (0..24) ou 'HH:mm' (ex.: `7` ou `'07:30'`). */
  startHour: GridHour;
  /** Base do grid: hora (0..24, > startHour) ou 'HH:mm'. */
  endHour: GridHour;
  /** Granularidade das linhas de horário, em minutos (ex.: 30). Equivale ao `slotDuration` do FullCalendar. */
  slotMinutes: number;
  /** Escala vertical: pixels por minuto. */
  pxPerMinute: number;
  /** Timezone de exibição (IANA). */
  timeZone: string;
  /** Relógio injetável para a linha "agora" (epoch ms). null → Date.now() em runtime. */
  nowMs: number | null;
  /** Duração mínima visual/de interação de um evento, em minutos (altura mínima + resize). */
  minEventMinutes: number;
  /** Recursos visíveis nas views de recurso (undefined = todos). Toggle por recurso/grupo. */
  visibleResourceIds?: readonly string[];
}

export interface CalendarState {
  /** Data de referência ('YYYY-MM-DD'). */
  date: string;
  /** View ativa ('week' | 'day' | custom registrada). */
  viewName: string;
  events: readonly CalendarEvent[];
  constraints: ConstraintSet;
  options: CalendarOptions;
}

export const DEFAULT_OPTIONS: CalendarOptions = {
  locale: 'pt-BR',
  weekStart: 'MO',
  startHour: 6,
  endHour: 22,
  slotMinutes: 30,
  pxPerMinute: 1,
  timeZone: 'America/Sao_Paulo',
  nowMs: null,
  minEventMinutes: 15,
};

/** Reject unusable grid dimensions before views enter their slot-generation loops. */
export function validateCalendarOptions(options: CalendarOptions): void {
  const validHour = (value: GridHour): boolean => {
    if (typeof value === 'string' && !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$|^24:00(?::00)?$/.test(value)) return false;
    const hours = resolveHour(value);
    return Number.isFinite(hours) && hours >= 0 && hours <= 24;
  };
  const validRange = validHour(options.startHour) && validHour(options.endHour)
    && resolveHour(options.endHour) > resolveHour(options.startHour);
  if (!validRange) throw new RangeError('[meucalendario] startHour/endHour devem formar um intervalo dentro de 00:00–24:00.');
  const validSlot = Number.isFinite(options.slotMinutes) && options.slotMinutes > 0 && options.slotMinutes <= 1440;
  if (!validSlot) throw new RangeError('[meucalendario] slotMinutes deve ser maior que zero e no máximo 1440.');
  const validScale = Number.isFinite(options.pxPerMinute) && options.pxPerMinute > 0;
  if (!validScale) throw new RangeError('[meucalendario] pxPerMinute deve ser maior que zero.');
  const validMinimum = Number.isFinite(options.minEventMinutes) && options.minEventMinutes > 0 && options.minEventMinutes <= 1440;
  if (!validMinimum) throw new RangeError('[meucalendario] minEventMinutes deve estar entre zero e 1440.');
}
