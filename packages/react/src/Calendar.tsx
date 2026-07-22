/** @jsxRuntime automatic @jsxImportSource react */
/**
 * `<Calendar/>` (Fase 5) — adapter React idiomático e FINO.
 *
 * Regra de ouro (ADR-001/002): a instância do `CalendarApp` é criada **UMA vez** e montada num
 * `<div>` próprio; o React NUNCA reconcilia a árvore interna (que é Preact). Mudanças de props são
 * aplicadas pela **API imperativa** do core (setEvents/changeView/…), com guardas anti-redundância.
 * Callbacks e `eventSource` são lidos de um ref → ficam "estáveis" para o core, mas sempre chamam
 * a versão mais recente das props. Isso mata o rerender parasita e o diff manual do wsaude.
 */
import { useEffect, useRef } from 'react';
import { createElement as h } from 'preact';
import { CalendarApp, type CalendarConfig } from '@meucalendario/core';
import { ReactIsland } from './ReactIsland.js';
import { createHandle } from './handle.js';
import type { CalendarProps } from './types.js';

export function Calendar(props: CalendarProps): React.JSX.Element {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const appRef = useRef<CalendarApp | null>(null);

	// Sempre a versão mais recente das props (callbacks/eventSource/renderEvent/customToolbar).
	const propsRef = useRef(props);
	propsRef.current = props;

	// --- cria a instância UMA vez -------------------------------------------
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return undefined;

		const config: CalendarConfig = {
			onEventClick: (occurrence) => propsRef.current.onEventClick?.(occurrence),
			onDateClick: (dateISO, minuteOfDay) => propsRef.current.onDateClick?.(dateISO, minuteOfDay),
			onEventDrop: (change) => propsRef.current.onEventDrop?.(change),
			onEventResize: (change) => propsRef.current.onEventResize?.(change),
			onDateSelect: (selection) => propsRef.current.onDateSelect?.(selection),
			onDropBlocked: (info) => propsRef.current.onDropBlocked?.(info),
			onClickBlocked: (info) => propsRef.current.onClickBlocked?.(info),
		};
		const initial = propsRef.current;
		if (initial.date !== undefined) config.date = initial.date;
		if (initial.view !== undefined) config.view = initial.view;
		if (initial.events !== undefined) config.events = [...initial.events];
		if (initial.constraints !== undefined) config.constraints = initial.constraints;
		if (initial.options !== undefined) config.options = initial.options;
		if (initial.resources !== undefined) config.resources = initial.resources;
		if (initial.views !== undefined) config.views = initial.views;
		if (initial.temporal !== undefined) config.temporal = initial.temporal;
		if (initial.eventSource) config.eventSource = (range) => propsRef.current.eventSource!(range);
		if (initial.renderEvent) {
			config.renderEvent = (info) => h(ReactIsland, { node: propsRef.current.renderEvent!(info) });
		}
		if (initial.customToolbar) {
			config.renderToolbar = (context) =>
				h(ReactIsland, { node: propsRef.current.customToolbar!(context) });
		}

		const app = new CalendarApp(config);
		appRef.current = app;
		app.mount(container);

		const apiRef = propsRef.current.apiRef;
		if (apiRef) apiRef.current = createHandle(app);

		return () => {
			app.destroy();
			appRef.current = null;
			if (apiRef) apiRef.current = null;
		};
		// Instância criada uma única vez — props subsequentes entram pelos efeitos de sync abaixo.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// --- sincroniza props → API imperativa (sem recriar a instância) ---------
	useEffect(() => {
		appRef.current?.setEvents(props.events ?? []);
	}, [props.events]);

	useEffect(() => {
		const app = appRef.current;
		if (app && props.constraints) app.setConstraints(props.constraints);
	}, [props.constraints]);

	useEffect(() => {
		const app = appRef.current;
		if (app && props.options) app.setOptions(props.options);
	}, [props.options]);

	useEffect(() => {
		const app = appRef.current;
		if (app && props.resources) app.setResources(props.resources);
	}, [props.resources]);

	useEffect(() => {
		const app = appRef.current;
		if (!app || props.view === undefined) return;
		const differsFromCurrent = app.getState().viewName !== props.view;
		if (differsFromCurrent) app.changeView(props.view);
	}, [props.view]);

	useEffect(() => {
		const app = appRef.current;
		if (!app || props.date === undefined) return;
		const differsFromCurrent = app.getState().date !== props.date;
		if (differsFromCurrent) app.setDate(props.date);
	}, [props.date]);

	useEffect(() => {
		const app = appRef.current;
		if (app && props.refetchKey !== undefined) app.refetch();
	}, [props.refetchKey]);

	return (
		<div
			ref={containerRef}
			className={props.className}
			style={props.style}
			data-mc-react-root
		/>
	);
}
