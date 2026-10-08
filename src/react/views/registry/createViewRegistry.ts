import type { CalendarView } from '../../viewTypes.js';

/** Validate the complete selection before mutating an existing calendar. */
export function createViewRegistry(views: readonly CalendarView[]): Map<string, CalendarView> {
  if (!Array.isArray(views) || views.length === 0)
    throw new Error('[meucalendario] informe pelo menos uma view');

  const registry = new Map<string, CalendarView>();
  for (const view of views) {
    if (!view.name.trim()) throw new Error('[meucalendario] o nome da view não pode ser vazio');
    if (registry.has(view.name)) throw new Error(`[meucalendario] view duplicada: ${view.name}`);
    registry.set(view.name, view);
  }
  return registry;
}
