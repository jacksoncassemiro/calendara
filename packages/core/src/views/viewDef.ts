/**
 * Contrato público de view. Uma view é lógica pura (range/navegação/título) + um `render` que
 * devolve a árvore Preact do corpo. Registrar view nova é 1ª classe (CalendarApp.registerView) —
 * nada aqui é travado às internas (Week/Day/Month/NDays/List são só implementações deste contrato).
 */
import type { ComponentChildren } from 'preact';
import type { TemporalLike } from '../date/temporal.js';
import type { DateUtils } from '../date/dateUtils.js';
import type { CalendarOptions } from '../render/state.js';
import type { CalendarEvent, EventOccurrence } from '../types/event.js';
import type { ConstraintSet } from '../types/constraint.js';

type PlainDate = InstanceType<TemporalLike['PlainDate']>;

/** Contexto de lógica pura (sem ocorrências) — usado por getRange/navigate/getTitle. */
export interface ViewContext {
  temporal: TemporalLike;
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

/** Info entregue ao slot de render de evento (customização de conteúdo). */
export interface EventSlotInfo {
  occurrence: EventOccurrence;
  event: CalendarEvent;
  /** Rótulo de horário pronto (ex.: '09:00'). Vazio em all-day. */
  timeLabel: string;
  isAllDay: boolean;
}

/** Slot opcional para renderizar o conteúdo de um evento. */
export type EventRenderSlot = (info: EventSlotInfo) => ComponentChildren;

/** Contexto completo entregue ao `render` da view (já com ocorrências expandidas no range). */
export interface ViewRenderContext {
  temporal: TemporalLike;
  dateUtils: DateUtils;
  options: CalendarOptions;
  range: ViewRange;
  /** Ocorrências já expandidas dentro do range visível. */
  occurrences: EventOccurrence[];
  constraints: ConstraintSet;
  /** Epoch ms de "agora" (injetável). */
  nowMs: number;
  /** Slot custom para o conteúdo de evento (opcional). */
  renderEvent?: EventRenderSlot;
  /** Callback de clique em evento (opcional; interação plena na Fase 4). */
  onEventClick?: (occurrence: EventOccurrence) => void;
  /** Callback de clique em data/slot vazio (opcional). */
  onDateClick?: (dateISO: string, minuteOfDay?: number) => void;
}

export interface CalendarView {
  name: string;
  label: string;
  getRange(date: PlainDate, context: ViewContext): ViewRange;
  navigate(direction: 'prev' | 'next', date: PlainDate, context: ViewContext): PlainDate;
  getTitle(range: ViewRange, context: ViewContext): string;
  /** Desenha o corpo da view. Retorna a árvore Preact. */
  render(context: ViewRenderContext): ComponentChildren;
}

/** Contexto entregue à toolbar (default ou custom via render-prop). */
export interface ToolbarContext {
  title: string;
  viewName: string;
  views: { name: string; label: string }[];
  goPrev(): void;
  goNext(): void;
  goToday(): void;
  changeView(name: string): void;
}

/** Slot opcional para renderizar a toolbar inteira. */
export type ToolbarRenderSlot = (context: ToolbarContext) => ComponentChildren;
