/**
 * Contrato interno de view do time-grid. Uma view é só lógica pura (range/navegação/título);
 * o desenho é o componente Preact `TimeGrid` compartilhado. Registrar view nova é 1ª classe
 * (CalendarApp.registerView) — nada aqui é travado às internas (ADR / 03-ARQUITETURA).
 */
import type { TemporalLike } from '../date/temporal.js';
import type { DateUtils } from '../date/dateUtils.js';
import type { CalendarOptions } from '../render/state.js';

type PlainDate = InstanceType<TemporalLike['PlainDate']>;

export interface ViewContext {
  T: TemporalLike;
  dateUtils: DateUtils;
  options: CalendarOptions;
}

export interface ViewRange {
  /** Dias visíveis (PlainDate), em ordem. */
  days: PlainDate[];
  /** Primeiro dia (inclusivo). */
  startDate: PlainDate;
  /** Último dia (inclusivo). */
  endDate: PlainDate;
}

export interface TimeGridViewDef {
  name: string;
  label: string;
  getRange(date: PlainDate, ctx: ViewContext): ViewRange;
  navigate(dir: 'prev' | 'next', date: PlainDate, ctx: ViewContext): PlainDate;
  getTitle(range: ViewRange, ctx: ViewContext): string;
}
