/** @jsxRuntime automatic @jsxImportSource react */
/**
 * Native React calendar. The controller publishes cached React snapshots while the
 * consumer's React tree owns rendering, contexts and component lifecycle.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CalendarApp, type CalendarConfig } from './app/calendarApp.js';
import { createHandle } from './handle.js';
import type { CalendarProps } from './types.js';

export function Calendar(props: CalendarProps): React.JSX.Element {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const appRef = useRef<CalendarApp | null>(null);
	const syncedPropsRef = useRef<CalendarProps | null>(null);
	const [mountedApp, setMountedApp] = useState<CalendarApp | null>(null);
	const subscribe = useCallback((notify: () => void) =>
		mountedApp?.on('render', notify) ?? (() => {}), [mountedApp]);
	const getSnapshot = useCallback(() => mountedApp?.getSnapshot() ?? null, [mountedApp]);
	const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => null);

	// Sempre a versão mais recente das props (callbacks/eventSource/renderEvent/customToolbar).
	const propsRef = useRef(props);
	useEffect(() => {
		propsRef.current = props;
	});

	// --- cria a instância UMA vez -------------------------------------------
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return undefined;

		const config: CalendarConfig = {
			onEventClick: (occurrence) => propsRef.current.onEventClick?.(occurrence),
			onMonthMoreClick: (info) => propsRef.current.onMonthMoreClick?.(info),
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
		if (initial.eventSource) config.eventSource = initial.eventSource;

		const app = new CalendarApp(config);
		syncedPropsRef.current = null;
		appRef.current = app;
		app.mount(container, { external: true });
		setMountedApp(app);

		return () => {
			app.destroy();
			appRef.current = null;
		};
		// Instância criada uma única vez — props subsequentes entram pelos efeitos de sync abaixo.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		const apiRef = props.apiRef;
		const app = appRef.current;
		if (!apiRef || !app) return;
		apiRef.current = createHandle(app);
		return () => { apiRef.current = null; };
	}, [props.apiRef]);

	const lastRefetchKey = useRef(props.refetchKey);
	useEffect(() => {
		const app = appRef.current;
		if (!app) return;
		const previous = syncedPropsRef.current;
		app.batchUpdate(() => {
			if (!previous || previous.views !== props.views) app.setViews(props.views ?? []);
			if (!previous || previous.eventSource !== props.eventSource) app.setEventSource(props.eventSource);
			if (!previous || previous.renderEvent !== props.renderEvent) app.setRenderEvent(props.renderEvent);
			if (!previous || previous.renderMonthMore !== props.renderMonthMore) app.setRenderMonthMore(props.renderMonthMore);
			if (!previous || previous.customToolbar !== props.customToolbar) app.setRenderToolbar(props.customToolbar);
			if ((!previous || previous.events !== props.events) && props.events !== undefined) app.setEvents(props.events);
			if (!previous || previous.constraints !== props.constraints) app.setConstraints(props.constraints ?? {});
			if ((!previous || previous.options !== props.options) && props.options !== undefined) app.setOptions(props.options);
			if (!previous || previous.resources !== props.resources) app.setResources(props.resources);
			if ((!previous || previous.view !== props.view) && props.view !== undefined && app.getState().viewName !== props.view) app.changeView(props.view);
			if ((!previous || previous.date !== props.date) && props.date !== undefined && app.getState().date !== props.date) app.setDate(props.date);
			if (lastRefetchKey.current !== props.refetchKey) app.refetch();
			lastRefetchKey.current = props.refetchKey;
		});
		syncedPropsRef.current = props;
	}, [props.views, props.eventSource, props.renderEvent, props.customToolbar,
		props.events, props.constraints, props.options, props.resources, props.renderMonthMore,
		props.view, props.date, props.refetchKey]);
	return (
		<div
			ref={containerRef}
			className={props.className}
			style={props.style}
			data-mc-react-root
		>{snapshot}</div>
	);
}
