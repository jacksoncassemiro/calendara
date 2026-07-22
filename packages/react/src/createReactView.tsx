/**
 * `createReactView` (Fase 5) — autoria de view com o CORPO escrito em React.
 *
 * IMPORTANTE: views customizadas em "vanilla"/Preact JÁ funcionam sem adapter — basta
 * `app.registerView({ name, getRange, navigate, getTitle, render })` com um `render` que devolve
 * nós Preact. Este helper é só a conveniência para quem quer o corpo em React (hooks, libs React):
 * embrulha o resultado numa `ReactIsland`. `getRange`/`navigate`/`getTitle` têm default de 1 dia.
 */
import { createElement } from 'preact';
import type {
	CalendarView,
	ViewContext,
	ViewRange,
	ViewRenderContext,
	TemporalLike,
} from '@meucalendario/core';
import type { ReactNode } from 'react';
import { ReactIsland } from './ReactIsland.js';

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
			return createElement(ReactIsland, { node: Body(context) });
		},
	};
}
