/**
 * Tipos e defaults do estado de render do CalendarApp.
 * (Estado puro de dados — o Preact é apenas o desenhador.)
 */
import type { WeekdayCode } from '../types/datetime.js';
import type { CalendarEvent } from '../types/event.js';
import type { ConstraintSet } from '../types/constraint.js';

/** Opções visuais/comportamentais. Escala de horário é dinâmica (startHour/endHour/slotMinutes). */
export interface CalendarOptions {
  locale: string;
  /** Primeiro dia da semana (afeta a view Week). */
  weekStart: WeekdayCode;
  /** Hora do topo do grid (0..24). */
  startHour: number;
  /** Hora da base do grid (0..24, > startHour). */
  endHour: number;
  /** Granularidade das linhas de horário, em minutos (ex.: 30). */
  slotMinutes: number;
  /** Escala vertical: pixels por minuto. */
  pxPerMinute: number;
  /** Timezone de exibição (IANA). */
  timeZone: string;
  /** Relógio injetável para a linha "agora" (epoch ms). null → Date.now() em runtime. */
  nowMs: number | null;
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
};
