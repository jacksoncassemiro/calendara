/**
 * Create a native React view body with default one-day range and navigation.
 * @remarks Português: Cria uma view React com período e navegação de um dia por padrão.
 */
import type {
	CalendarView,
	ViewContext,
	ViewRange,
	ViewRenderContext,
} from './viewTypes.js';
import type { TemporalLike } from '../core/index.js';
import { createElement as createReactElement, type ReactNode } from 'react';

type PlainDate = InstanceType<TemporalLike['PlainDate']>;

/** Configure the identity and date logic of a custom React view.
 * @remarks Português: Define identidade, período, navegação e título da view personalizada.
 */
export interface ReactViewConfig {
	/** Unique name used by views, initialView and changeView.
	 * @remarks Português: Nome único usado no registro e na seleção da view.
	 */
	name: string;
	/** Label shown in the view selector.
	 * @remarks Português: Rótulo exibido no seletor de views.
	 */
	label: string;
	/** Resolve visible dates with inclusive range endpoints; default is the reference date.
	 * @remarks Português: Define os dias visíveis e extremos inclusivos; por padrão exibe
	 * somente a data de referência.
	 */
	getRange?: (date: PlainDate, context: ViewContext) => ViewRange;
	/** Resolve the reference date for previous or next navigation; default is one day.
	 * @remarks Português: Define a data após navegar para anterior ou próximo; por padrão avança
	 * ou recua um dia.
	 */
	navigate?: (direction: 'prev' | 'next', date: PlainDate, context: ViewContext) => PlainDate;
	/** Format the view title; default is the range start in ISO format.
	 * @remarks Português: Formata o título; por padrão usa a data inicial do período em ISO.
	 */
	getTitle?: (range: ViewRange, context: ViewContext) => string;
}

/** Create a CalendarView rendered as a native React component.
 * @remarks Português: Cria uma view cujo corpo recebe o contexto e mantém o ciclo de vida
 * React. Inclua o resultado em views; mantenha a definição e a identidade de Body estáveis.
 * @param config - View identity and optional date logic.
 * @param Body - React component receiving the resolved rendering context.
 * @returns A view definition ready for calendar registration.
 */
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
