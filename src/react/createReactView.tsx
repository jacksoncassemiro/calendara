/**
 * Create a native React view body with default one-day range and navigation.
 */
import type {
	CalendarView,
	ViewContext,
	ViewRange,
	ViewRenderContext,
} from './views/viewDef.js';
import type { TemporalLike } from '../core/index.js';
import { createElement as createReactElement, type ReactNode } from 'react';

type PlainDate = InstanceType<TemporalLike['PlainDate']>;

export interface ReactViewConfig {
	name: string;
	label: string;
	/** Dias visíveis. Default: só a data de referência (view de 1 dia). */
	getRange?: (date: PlainDate, context: ViewContext) => ViewRange;
	/** Navegação. Default: ±1 dia. */
	navigate?: (direction: 'prev' | 'next', date: PlainDate, context: ViewContext) => PlainDate;
	/** Título. Default: a data ISO de início. */
	getTitle?: (range: ViewRange, context: ViewContext) => string;
}

/** Cria um `CalendarView` cujo corpo é um componente React. */
export function createReactView(
	config: ReactViewConfig,
	Body: (context: ViewRenderContext) => ReactNode,
): CalendarView {
	const getRange =
		config.getRange ?? ((date: PlainDate): ViewRange => ({ days: [date], startDate: date, endDate: date }));
	const navigate =
		config.navigate ??
		((direction: 'prev' | 'next', date: PlainDate): PlainDate =>
			direction === 'next' ? date.add({ days: 1 }) : date.subtract({ days: 1 }));
	const getTitle = config.getTitle ?? ((range: ViewRange): string => range.startDate.toString());

	return {
		name: config.name,
		label: config.label,
		getRange,
		navigate,
		getTitle,
		render(context: ViewRenderContext) {
			return createReactElement(Body, context);
		},
	};
}
