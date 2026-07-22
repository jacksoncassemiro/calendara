/**
 * Tipos públicos do adapter React. `CalendarProps` é a superfície declarativa do `<Calendar/>`;
 * `CalendarHandle` é a API imperativa (via `apiRef`/`useCalendar`) para casos que precisam
 * comandar o calendário (prev/next/troca de view) fora do fluxo de props.
 */
import type { CSSProperties, MutableRefObject, ReactNode } from 'react';
import type {
	CalendarEvent,
	EventOccurrence,
	ConstraintSet,
	CalendarResource,
	CalendarOptions,
	CalendarState,
	CalendarView,
	RangeChange,
	ToolbarContext,
	EventSlotInfo,
	EventChange,
	SelectionChange,
	BlockedInfo,
	CommitResult,
	Slot,
	SlotEvaluation,
	TemporalLike,
} from '@meucalendario/core';

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
	/** Views extras registradas (1ª classe). */
	views?: CalendarView[];
	/** Temporal injetado (SSR/testes). Ausente → o core carrega via ensureTemporal(). */
	temporal?: TemporalLike;
	/** Busca eventos por range visível (expansão lazy). */
	eventSource?: (range: RangeChange) => CalendarEvent[] | Promise<CalendarEvent[]>;
	/** Muda de valor → dispara um refetch (mesmo range). */
	refetchKey?: string | number;
	/** Conteúdo custom de evento, escrito em React (ilha). */
	renderEvent?: (info: EventSlotInfo) => ReactNode;
	/** Toolbar custom em React (ilha). Presente ⇒ substitui a toolbar nativa. */
	customToolbar?: (context: ToolbarContext) => ReactNode;
	onEventClick?: (occurrence: EventOccurrence) => void;
	onDateClick?: (dateISO: string, minuteOfDay?: number) => void;
	onEventDrop?: (change: EventChange) => CommitResult;
	onEventResize?: (change: EventChange) => CommitResult;
	onDateSelect?: (selection: SelectionChange) => void;
	onDropBlocked?: (info: BlockedInfo) => void;
	onClickBlocked?: (info: BlockedInfo) => void;
	/** Recebe a API imperativa (use com `useCalendar`). */
	apiRef?: MutableRefObject<CalendarHandle | null>;
	className?: string;
	style?: CSSProperties;
}
