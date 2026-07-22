/**
 * Contrato público de View. Criar view nova é 1ª classe (registerView) — nunca travado
 * às views internas. Ver docs/03-ARQUITETURA.md.
 *
 * NOTA: assinaturas usam `unknown` para os tipos Temporal/estado de render que só se
 * materializam na Fase 2 (render Preact). O contrato é fixado aqui na Fase 1 para os tipos
 * do core já nascerem view-aware, mas as views concretas chegam nas Fases 2/3.
 */
import type { EventOccurrence } from './event.js';
import type { ConstraintSet } from './constraint.js';

/** Estado entregue à view em cada update (eventos já expandidos e posicionados). */
export interface ViewState {
  /** Data de referência (Temporal.PlainDate no runtime). */
  date: unknown;
  /** Ocorrências visíveis já expandidas. Geometria é anexada na Fase 2. */
  occurrences: EventOccurrence[];
  constraints?: ConstraintSet;
  locale: string;
}

/** Range visível — dispara o eventSource.fetch. */
export interface VisibleRange {
  /** Temporal.PlainDate/PlainDateTime no runtime. */
  start: unknown;
  end: unknown;
}

/** API mínima que o core injeta na view. Expandida nas fases de render/interação. */
export interface CalendarViewAPI {
  getLocale(): string;
}

export interface ICalendarView {
  mount(container: HTMLElement, api: CalendarViewAPI): void;
  update(state: ViewState): void;
  destroy(): void;
  getTitle(date: unknown, locale: string): string;
  navigate(dir: 'prev' | 'next', date: unknown): unknown;
  getRange(date: unknown): VisibleRange;
}

export type ViewFactory = () => ICalendarView;
