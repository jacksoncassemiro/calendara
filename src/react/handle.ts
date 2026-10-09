/** Expose controller actions without exposing its internal instance.
 * @remarks Português: Expõe ações do controlador sem expor sua instância interna.
 */
import type { CalendarApp } from './app/calendarApp.js';
import type { CalendarHandle } from './types.js';

/** Adapt the controller to the stable public API.
 * @remarks Português: Adapta o controlador à API pública estável.
 */
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
    evaluatePlacement: (input) =>
      app.evaluatePlacement({ ...input, kind: input.occurrence ? 'move' : 'select' }),
    evaluateEvent: (event, occurrence) => app.evaluateEvent(event, occurrence),
    refetch: () => app.refetch(),
  };
}
