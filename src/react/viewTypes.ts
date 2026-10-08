/**
 * Contrato público de view. Uma view é lógica pura (range/navegação/título) + um `render` que
 * devolve a árvore React do corpo. Registrar view nova é 1ª classe (CalendarApp.registerView) —
 * nada aqui é travado às internas (Week/Day/Month/NDays/List são só implementações deste contrato).
 */
import type { ReactNode, CSSProperties } from 'react';
import type { TemporalLike } from '../core/index.js';
import type { DateUtils } from '../core/index.js';
import type { CalendarOptions } from '../core/index.js';
import type { CalendarEvent, EventOccurrence } from '../core/index.js';
import type { ConstraintSet } from '../core/index.js';
import type { InteractionDraft } from '../core/index.js';
import type { CalendarResource } from '../core/index.js';

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
export type EventRenderSlot = (info: EventSlotInfo) => ReactNode;

export interface MonthMoreInfo {
  dateISO: string;
  occurrences: readonly EventOccurrence[];
  hiddenOccurrences: readonly EventOccurrence[];
  anchor: HTMLElement;
  close(): void;
  openView(viewName: string): void;
}
export type EventMoreInfo = MonthMoreInfo;
export type EventMoreRenderSlot = MonthMoreRenderSlot;
export type MonthMoreRenderSlot = (info: MonthMoreInfo) => ReactNode;

/** Contexto completo entregue ao `render` da view (já com ocorrências expandidas no range). */
export interface DayStyleInfo {
  dateISO: string;
  viewName: string;
  resourceId?: string;
}
export type DayStyleCallback = (info: DayStyleInfo) => CSSProperties | undefined;
export interface ViewRenderContext {
  viewName?: string;
  getDayStyle?: DayStyleCallback;
  /** Live resources supplied by the calendar; absent preserves factory resources. */
  resources?: readonly CalendarResource[];
  temporal: TemporalLike;
  dateUtils: DateUtils;
  options: CalendarOptions;
  range: ViewRange;
  /** Ocorrências já expandidas dentro do range visível. */
  occurrences: EventOccurrence[];
  /** Adjacent occurrences for resource buffer shading; not visible event content. */
  resourceBufferOccurrences?: readonly EventOccurrence[];
  constraints: ConstraintSet;
  /** Epoch ms de "agora" (injetável). */
  nowMs: number;
  /** Rascunho vivo do gesto (drag/resize/select) para desenhar o fantasma. */
  draft?: InteractionDraft;
  /** Slot custom para o conteúdo de evento (opcional). */
  renderEvent?: EventRenderSlot;
  renderMonthMore?: MonthMoreRenderSlot;
  renderEventMore?: MonthMoreRenderSlot;
  /** Return false to replace the built-in opening behavior. */
  onMonthMoreClick?: (info: MonthMoreInfo) => void | false;
  onEventMoreClick?: (info: MonthMoreInfo) => void | false;
  openDateView?: (dateISO: string, viewName: string) => void;
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
  /** Desenha o corpo da view. Retorna a árvore React. */
  render(context: ViewRenderContext): ReactNode;
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
export type ToolbarRenderSlot = (context: ToolbarContext) => ReactNode;
