/**
 * Adapta a API imperativa do `CalendarApp` para o `CalendarHandle` público (superfície estável,
 * sem vazar o objeto interno do core).
 */
import type { CalendarApp } from './app/calendarApp.js';
import type { CalendarHandle } from './types.js';

export function createHandle(app: CalendarApp): CalendarHandle {
	return {
		prev: () => app.prev(),
		next: () => app.next(),
		today: () => app.today(),
		setDate: (dateISO) => app.setDate(dateISO),
		changeView: (viewName) => app.changeView(viewName),
		getTitle: () => app.getTitle(),
		getVisibleRange: () => app.getVisibleRange(),
		getState: () => app.getState(),
		listViews: () => app.listViews(),
		evaluateSlot: (slot) => app.evaluateSlot(slot),
		evaluatePlacement: (input) => app.evaluatePlacement({ ...input, kind: input.occurrence ? 'move' : 'select' }),
		refetch: () => app.refetch(),
	};
}
