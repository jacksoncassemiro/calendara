/**
 * CalendarApp — orquestrador headless (ADR-001/002).
 *
 * Responsabilidade: manter o store (fonte de verdade), resolver o Temporal, expor uma API
 * imperativa (prev/next/today/changeView/setEvents/setConstraints/…) e renderizar a si mesmo
 * com Preact num container isolado. Navegar/trocar view = `setState` → o Preact faz o diff no
 * MESMO container; a instância NUNCA é recriada (mata o rerender parasita do host).
 *
 * Pipeline por render: expandir recorrência (memoizada) no range → montar ViewRenderContext →
 * a view ativa desenha o corpo → o Shell envolve com a toolbar → Preact.
 *
 * eventSource: quando fornecido, o range visível dispara `fetch({start,end})` (expansão lazy);
 * o resultado vira os eventos do store.
 */
import { render as preactRender, h as createElement } from 'preact';

import { createStore, type Store } from '../store/store.js';
import { memoize } from '../store/memoize.js';
import { ensureTemporal, type TemporalLike } from '../date/temporal.js';
import { createDateUtils, type DateUtils } from '../date/dateUtils.js';
import { ConstraintEngine, type Slot } from '../constraint/constraintEngine.js';
import type { CalendarEvent, EventOccurrence } from '../types/event.js';
import type { ConstraintSet, SlotEvaluation } from '../types/constraint.js';

import { expandRange } from './derive.js';
import {
  DEFAULT_OPTIONS,
  type CalendarOptions,
  type CalendarState,
} from './state.js';

import { BUILTIN_VIEWS } from '../views/index.js';
import { weekView } from '../views/timeGridViews.js';
import { CalendarShell } from '../views/Shell.js';
import type {
  CalendarView,
  ViewContext,
  ViewRange,
  ViewRenderContext,
  ToolbarContext,
  EventRenderSlot,
  ToolbarRenderSlot,
} from '../views/viewDef.js';

type PlainDate = InstanceType<TemporalLike['PlainDate']>;

export type CalendarEventName = 'render' | 'dateChange' | 'viewChange' | 'rangeChange';

export interface RangeChange {
  start: string;
  end: string;
}

/** Fonte de eventos por range (expansão lazy). Pode ser síncrona ou assíncrona. */
export type EventSource = (
  range: RangeChange,
) => CalendarEvent[] | Promise<CalendarEvent[]>;

export interface CalendarConfig {
  date?: string;
  view?: string;
  events?: CalendarEvent[];
  constraints?: ConstraintSet;
  options?: Partial<CalendarOptions>;
  /** Views extras (além das internas). Registrar view nova é 1ª classe. */
  views?: CalendarView[];
  /** Injeta Temporal já resolvido (testes/SSR). Ausente → carrega via ensureTemporal(). */
  temporal?: TemporalLike;
  /** Busca eventos por range visível (dispara em cada mudança de range). */
  eventSource?: EventSource;
  /** Slot para conteúdo customizado de evento. */
  renderEvent?: EventRenderSlot;
  /** Slot para toolbar customizada (render-prop). */
  renderToolbar?: ToolbarRenderSlot;
  onEventClick?: (occurrence: EventOccurrence) => void;
  onDateClick?: (dateISO: string, minuteOfDay?: number) => void;
}

function padTwo(value: number): string {
  return value < 10 ? `0${value}` : `${value}`;
}

export class CalendarApp {
  private readonly store: Store<CalendarState>;
  private readonly views = new Map<string, CalendarView>();
  private readonly engine: ConstraintEngine;
  private readonly listeners = new Map<CalendarEventName, Set<(payload: unknown) => void>>();
  private readonly readyPromise: Promise<void>;
  private readonly memoExpand = memoize(expandRange);

  private readonly eventSource: EventSource | undefined;
  private readonly renderEvent: EventRenderSlot | undefined;
  private readonly renderToolbar: ToolbarRenderSlot | undefined;
  private readonly onEventClick: ((occurrence: EventOccurrence) => void) | undefined;
  private readonly onDateClick: ((dateISO: string, minuteOfDay?: number) => void) | undefined;

  private container: HTMLElement | null = null;
  private unsubscribe: (() => void) | null = null;
  private temporal: TemporalLike | null = null;
  private dateUtils: DateUtils | null = null;
  private fetchToken = 0;

  constructor(config: CalendarConfig = {}) {
    const options: CalendarOptions = { ...DEFAULT_OPTIONS, ...config.options };
    const initialState: CalendarState = {
      date: config.date ?? this.localTodayISO(),
      viewName: config.view ?? 'week',
      events: config.events ?? [],
      constraints: config.constraints ?? {},
      options,
    };
    this.store = createStore(initialState);
    for (const view of BUILTIN_VIEWS) this.views.set(view.name, view);
    for (const view of config.views ?? []) this.views.set(view.name, view);
    this.engine = new ConstraintEngine(initialState.constraints);

    this.eventSource = config.eventSource;
    this.renderEvent = config.renderEvent;
    this.renderToolbar = config.renderToolbar;
    this.onEventClick = config.onEventClick;
    this.onDateClick = config.onDateClick;

    const temporalPromise = config.temporal
      ? Promise.resolve(config.temporal)
      : ensureTemporal();
    this.readyPromise = temporalPromise.then((resolvedTemporal) => {
      this.temporal = resolvedTemporal;
      this.dateUtils = createDateUtils(resolvedTemporal);
      return this.runInitialFetch();
    });
  }

  // ---- ciclo de vida ---------------------------------------------------------

  /** Monta o calendário no container. Renderiza assim que Temporal + fetch inicial estiverem prontos. */
  mount(container: HTMLElement): void {
    this.container = container;
    if (!this.unsubscribe) {
      this.unsubscribe = this.store.subscribe(() => this.renderNow());
    }
    void this.readyPromise.then(() => this.renderNow());
  }

  /** Resolve quando Temporal + fetch inicial estão prontos e um primeiro render (se montado) ocorreu. */
  ready(): Promise<void> {
    return this.readyPromise.then(() => {
      if (this.container) this.renderNow();
    });
  }

  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.container) {
      preactRender(null, this.container);
      this.container = null;
    }
  }

  // ---- API imperativa --------------------------------------------------------

  getState(): Readonly<CalendarState> {
    return this.store.getState();
  }

  next(): void {
    this.navigate('next');
  }

  prev(): void {
    this.navigate('prev');
  }

  today(): void {
    this.setDate(this.todayISO());
  }

  setDate(dateISO: string): void {
    this.store.setState({ date: dateISO });
    this.emit('dateChange', dateISO);
    this.emitRange();
    this.refetch();
  }

  changeView(viewName: string): void {
    if (!this.views.has(viewName)) {
      throw new Error(`[meucalendario] view não registrada: ${viewName}`);
    }
    this.store.setState({ viewName });
    this.emit('viewChange', viewName);
    this.emitRange();
    this.refetch();
  }

  setEvents(events: readonly CalendarEvent[]): void {
    this.store.setState({ events });
  }

  setConstraints(constraints: ConstraintSet): void {
    this.engine.update(constraints);
    this.store.setState({ constraints });
  }

  setOptions(patch: Partial<CalendarOptions>): void {
    this.store.setState({ options: { ...this.store.getState().options, ...patch } });
  }

  /** Toggle de visibilidade de recursos nas views de recurso (undefined = todos). */
  setVisibleResources(resourceIds: readonly string[] | undefined): void {
    this.setOptions({ visibleResourceIds: resourceIds });
  }

  /** Registra/subscreve view nova (1ª classe). */
  registerView(view: CalendarView): void {
    this.views.set(view.name, view);
  }

  /** Views disponíveis (nome + rótulo). */
  listViews(): { name: string; label: string }[] {
    return [...this.views.values()].map((view) => ({ name: view.name, label: view.label }));
  }

  /** Título da view/data atuais. */
  getTitle(): string {
    const { view, range, context } = this.resolveView();
    return view.getTitle(range, context);
  }

  /** Range visível (datas ISO inclusivas) — dispara eventSource.fetch. */
  getVisibleRange(): RangeChange {
    const { range } = this.resolveView();
    return { start: range.startDate.toString(), end: range.endDate.toString() };
  }

  /** Delegação ao ConstraintEngine (mesma fonte da camada de fundo). */
  evaluateSlot(slot: Slot): SlotEvaluation {
    return this.engine.evaluate(slot);
  }

  on(eventName: CalendarEventName, callback: (payload: unknown) => void): () => void {
    let listenerSet = this.listeners.get(eventName);
    if (!listenerSet) {
      listenerSet = new Set();
      this.listeners.set(eventName, listenerSet);
    }
    listenerSet.add(callback);
    return () => listenerSet!.delete(callback);
  }

  // ---- interno ---------------------------------------------------------------

  private navigate(direction: 'prev' | 'next'): void {
    if (!this.temporal || !this.dateUtils) return;
    const { view, context } = this.resolveView();
    const currentDate = this.temporal.PlainDate.from(this.store.getState().date);
    const nextDate = view.navigate(direction, currentDate, context);
    this.setDate(nextDate.toString());
  }

  private resolveView(): {
    view: CalendarView;
    range: ViewRange;
    context: ViewContext;
    date: PlainDate;
  } {
    const temporal = this.temporal!;
    const state = this.store.getState();
    const view = this.views.get(state.viewName) ?? weekView;
    const context: ViewContext = {
      temporal,
      dateUtils: this.dateUtils!,
      options: state.options,
    };
    const date = temporal.PlainDate.from(state.date);
    const range = view.getRange(date, context);
    return { view, range, context, date };
  }

  private buildRenderContext(range: ViewRange): ViewRenderContext {
    const temporal = this.temporal!;
    const state = this.store.getState();
    const startISO = range.startDate.toString();
    const endISO = range.endDate.toString();
    // Memoizada por (temporal, events, start, end): trocar constraints não recomputa ocorrências.
    const occurrences: EventOccurrence[] = this.memoExpand(temporal, state.events, startISO, endISO);
    const nowMs = state.options.nowMs ?? Date.now();

    const context: ViewRenderContext = {
      temporal,
      dateUtils: this.dateUtils!,
      options: state.options,
      range,
      occurrences,
      constraints: state.constraints,
      nowMs,
    };
    if (this.renderEvent) context.renderEvent = this.renderEvent;
    if (this.onEventClick) context.onEventClick = this.onEventClick;
    if (this.onDateClick) context.onDateClick = this.onDateClick;
    return context;
  }

  private buildToolbarContext(view: CalendarView, range: ViewRange, context: ViewContext): ToolbarContext {
    return {
      title: view.getTitle(range, context),
      viewName: this.store.getState().viewName,
      views: this.listViews(),
      goPrev: () => this.prev(),
      goNext: () => this.next(),
      goToday: () => this.today(),
      changeView: (name: string) => this.changeView(name),
    };
  }

  private renderNow(): void {
    if (!this.temporal || !this.dateUtils || !this.container) return;
    const { view, range, context } = this.resolveView();
    const renderContext = this.buildRenderContext(range);
    const body = view.render(renderContext);
    const toolbar = this.buildToolbarContext(view, range, context);
    preactRender(
      createElement(CalendarShell, {
        toolbar,
        body,
        ...(this.renderToolbar ? { renderToolbar: this.renderToolbar } : {}),
      }),
      this.container,
    );
    this.emit('render', renderContext);
  }

  /** Busca inicial (parte do readyPromise, para que `ready()` aguarde os eventos). */
  private runInitialFetch(): void | Promise<void> {
    if (!this.eventSource) return;
    const token = ++this.fetchToken;
    const range = this.getVisibleRange();
    return Promise.resolve(this.eventSource(range)).then((events) => {
      const isLatestFetch = token === this.fetchToken;
      if (isLatestFetch) this.store.setState({ events });
    });
  }

  /** Refetch por mudança de range (assíncrono; ignora resultados obsoletos). */
  private refetch(): void {
    if (!this.eventSource || !this.temporal) return;
    const token = ++this.fetchToken;
    const range = this.getVisibleRange();
    void Promise.resolve(this.eventSource(range)).then((events) => {
      const isLatestFetch = token === this.fetchToken;
      if (isLatestFetch) this.store.setState({ events });
    });
  }

  private emit(eventName: CalendarEventName, payload: unknown): void {
    const listenerSet = this.listeners.get(eventName);
    if (!listenerSet) return;
    for (const callback of [...listenerSet]) callback(payload);
  }

  private emitRange(): void {
    if (!this.temporal) return;
    this.emit('rangeChange', this.getVisibleRange());
  }

  private todayISO(): string {
    if (this.temporal) {
      return this.temporal.Now.zonedDateTimeISO(this.store.getState().options.timeZone)
        .toPlainDate()
        .toString();
    }
    return this.localTodayISO();
  }

  private localTodayISO(): string {
    const now = new Date();
    return `${now.getFullYear()}-${padTwo(now.getMonth() + 1)}-${padTwo(now.getDate())}`;
  }
}
