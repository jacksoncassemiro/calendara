/**
 * Tipos públicos do adapter React. `CalendarProps` é a superfície declarativa do `<Calendar/>`;
 * `CalendarHandle` é a API imperativa (via `apiRef`/`useCalendar`) para casos que precisam
 * comandar o calendário (prev/next/troca de view) fora do fluxo de props.
 */
import type { CSSProperties, RefObject, ReactNode } from 'react';
import type {
	CalendarEvent,
	EventOccurrence,
	ConstraintSet,
	CalendarResource,
	CalendarOptions,
	CalendarState,
	EventChange,
	SelectionChange,
	BlockedInfo,
	CommitResult,
	Slot,
	SlotEvaluation,
	TemporalLike,
	EvaluationInput,
	DraftEvaluation,
} from '../core/index.js';

/** API imperativa estável do calendário. */
export interface CalendarHandle {
	prev(): void;
	next(): void;
	today(): void;
	setDate(dateISO: string): void;
	changeView(viewName: string): void;
	getTitle(): string;
	getVisibleRange(): RangeChange;
	getState(): Readonly<CalendarState>;
	listViews(): { name: string; label: string }[];
	evaluateSlot(slot: Slot): SlotEvaluation;
	/** Validate a timed placement including resource capacity and buffers. */
	evaluatePlacement(input: Omit<EvaluationInput, 'kind'>): DraftEvaluation;
	refetch(): void;
}

export interface CalendarProps {
	/** Data de referência ('YYYY-MM-DD'). */
	date?: string;
	/** View ativa ('week' | 'day' | 'month' | 'list' | custom). */
	view?: string;
	events?: readonly CalendarEvent[];
	constraints?: ConstraintSet;
	options?: Partial<CalendarOptions>;
	/** Recursos (capacity/buffers) — habilitam a validação dura de ocupação no drag. */
	resources?: readonly CalendarResource[];
	/** Lista completa de views disponíveis. Ausente usa as views padrão; a primeira é a inicial. */
	views?: readonly CalendarView[];
	/** Temporal injetado (SSR/testes). Ausente → o core carrega via ensureTemporal(). */
	temporal?: TemporalLike;
	/** Busca eventos por range visível (expansão lazy). */
	eventSource?: (range: RangeChange) => CalendarEvent[] | Promise<CalendarEvent[]>;
	/** Muda de valor → dispara um refetch (mesmo range). */
	refetchKey?: string | number;
	/** Conteúdo custom de evento, escrito em React (React nativo). */
	renderEvent?: (info: EventSlotInfo) => ReactNode;
	renderMonthMore?: MonthMoreRenderSlot;
  renderEventMore?: MonthMoreRenderSlot;
  getDayStyle?: DayStyleCallback;
	onMonthMoreClick?: (info: MonthMoreInfo) => void | false;
  onEventMoreClick?: (info: MonthMoreInfo) => void | false;
	/** Toolbar custom em React (React nativo). Presente ⇒ substitui a toolbar nativa. */
	customToolbar?: (context: ToolbarContext) => ReactNode;
	onEventClick?: (occurrence: EventOccurrence) => void;
	onDateClick?: (dateISO: string, minuteOfDay?: number) => void;
	onEventDrop?: (change: EventChange) => CommitResult;
	onEventResize?: (change: EventChange) => CommitResult;
	onDateSelect?: (selection: SelectionChange) => void;
	onDropBlocked?: (info: BlockedInfo) => void;
	onClickBlocked?: (info: BlockedInfo) => void;
	/** Recebe a API imperativa (use com `useCalendar`). */
	apiRef?: RefObject<CalendarHandle | null>;
	className?: string;
	style?: CSSProperties;
}

import type { CalendarView, ToolbarContext, EventSlotInfo, MonthMoreInfo, MonthMoreRenderSlot, DayStyleCallback } from './viewTypes.js';
import type { RangeChange } from './app/calendarApp.js';
