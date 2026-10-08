/**
 * CalendarApp — controlador do renderer React.
 *
 * Responsabilidade: manter o store (fonte de verdade), resolver o Temporal, expor uma API
 * imperativa (prev/next/today/changeView/setEvents/setConstraints/…) e publicar snapshots
 * React. Calendar monta esses snapshots na árvore do consumidor. A montagem direta do
 * controlador cria seu próprio root React. Mudanças de estado atualizam o snapshot.
 *
 * Pipeline por render: expandir recorrência (memoizada) no range → montar ViewRenderContext →
 * a view ativa desenha o corpo → o Shell envolve com a toolbar → React.
 *
 * eventSource: quando fornecido, o range visível dispara `fetch({start,end})` (expansão lazy);
 * o resultado vira os eventos do store.
 */
import { createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { keyboardGrid } from './keyboardGrid.js';
import { flushSync } from 'react-dom';

import { createStore, type Store } from '../../core/index.js';
import { memoize } from '../../core/index.js';
import { ensureTemporal, type TemporalLike } from '../../core/index.js';
import { createDateUtils, type DateUtils } from '../../core/index.js';
import { ConstraintEngine, type Slot } from '../../core/index.js';
import type { CalendarEvent, EventOccurrence } from '../../core/index.js';
import type { ConstraintSet, SlotEvaluation } from '../../core/index.js';
import type { CalendarResource } from '../../core/index.js';

import { expandRange, buildDays, occurrenceKey } from '../../core/index.js';
import { occurrencesForResource, resourceConstraintSet } from '../../core/index.js';
import {
  InteractionEngine,
  type EvaluationInput,
  type DraftEvaluation,
} from '../../core/index.js';
import {
  applyEventTimeChange,
  reassignResource,
  validateOccupancy,
  type InteractionDraft,
  type DraftReason,
  type EventChange,
  type SelectionChange,
  type BlockedInfo,
  type PointerSlot,
  type ResourceOccupancy,
  type CommitResult,
} from '../../core/index.js';
import {
  DEFAULT_OPTIONS,
  resolveHour,
  validateCalendarOptions,
  type CalendarOptions,
  type CalendarState,
} from '../../core/index.js';

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
  MonthMoreInfo,
  MonthMoreRenderSlot,
  ToolbarRenderSlot,
} from '../views/viewDef.js';

type PlainDate = InstanceType<TemporalLike['PlainDate']>;

export type CalendarEventName = 'render' | 'dateChange' | 'viewChange' | 'rangeChange' | 'error';

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
  renderMonthMore?: MonthMoreRenderSlot;
  renderEventMore?: MonthMoreRenderSlot;
  getDayStyle?: import("../views/viewDef.js").DayStyleCallback;
  onMonthMoreClick?: (info: MonthMoreInfo) => void | false;
  onEventMoreClick?: (info: MonthMoreInfo) => void | false;
  /** Slot para toolbar customizada (render-prop). */
  renderToolbar?: ToolbarRenderSlot;
  /** Recursos (capacity/buffers/businessHours) — habilitam a validação DURA de ocupação (Fase 4). */
  resources?: readonly CalendarResource[];
  onEventClick?: (occurrence: EventOccurrence) => void;
  onDateClick?: (dateISO: string, minuteOfDay?: number) => void;
  /** Evento arrastado para novo horário/dia. Retornar `false`/rejeitar ⇒ reverter (revert em falha). */
  onEventDrop?: (change: EventChange) => CommitResult;
  /** Evento redimensionado (nova duração). Retornar `false`/rejeitar ⇒ reverter. */
  onEventResize?: (change: EventChange) => CommitResult;
  /** Seleção de intervalo em área vazia (drag). */
  onDateSelect?: (selection: SelectionChange) => void;
  /** Drop de evento barrado (fora de expediente/bloqueio/lotação/buffer). */
  onDropBlocked?: (info: BlockedInfo) => void;
  /** Seleção/click barrado. */
  onClickBlocked?: (info: BlockedInfo) => void;
}

function padTwo(value: number): string {
  return value < 10 ? `0${value}` : `${value}`;
}

function validateResources(resources: readonly CalendarResource[] | undefined): void {
  const ids = new Set<string>();
  for (const resource of resources ?? []) {
    if (typeof resource.id !== 'string' || resource.id.length === 0 || ids.has(resource.id)) throw new RangeError('[meucalendario] id de recurso vazio ou duplicado');
    ids.add(resource.id);
    if (resource.capacity !== undefined && resource.capacity!==false && (!Number.isSafeInteger(resource.capacity) || resource.capacity <= 0)) throw new RangeError('[meucalendario] capacity deve ser inteiro positivo');
    for (const buffer of [resource.bufferBefore, resource.bufferAfter]) {
      if (buffer !== undefined && (!Number.isFinite(buffer) || buffer < 0)) throw new RangeError('[meucalendario] buffer deve ser finito e não negativo');
    }
  }
}

/**
 * rAF com fallback (ambientes sem `requestAnimationFrame` — node puro fora do jsdom). jsdom 24
 * já implementa rAF nativamente, então isto só protege SSR/testes exóticos. `setTimeout(~16ms)`
 * aproxima 1 frame quando não há um relógio de vídeo de verdade.
 */
function scheduleFrame(callback: () => void): number {
  const globalRaf = (globalThis as { requestAnimationFrame?: (cb: FrameRequestCallback) => number })
    .requestAnimationFrame;
  if (typeof globalRaf === 'function') return globalRaf(() => callback());
  return setTimeout(callback, 16) as unknown as number;
}

function cancelFrame(handle: number): void {
  const globalCancel = (globalThis as { cancelAnimationFrame?: (handle: number) => void })
    .cancelAnimationFrame;
  if (typeof globalCancel === 'function') {
    globalCancel(handle);
    return;
  }
  clearTimeout(handle);
}

/** Compare immutable plain data, retaining callback and class-instance identity. */
function equivalentData(left: unknown, right: unknown, seen = new WeakMap<object, WeakSet<object>>()): boolean {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object') return false;
  const prototype = Object.getPrototypeOf(left);
  if (prototype !== Object.getPrototypeOf(right)) return false;
  if (prototype !== Object.prototype && prototype !== null && !Array.isArray(left)) return false;
  if (Array.isArray(left) && (!Array.isArray(right) || left.length !== right.length)) return false;
  const visited = seen.get(left);
  if (visited?.has(right)) return true;
  if (visited) visited.add(right);
  else seen.set(left, new WeakSet([right]));
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  const a = left as Record<string, unknown>;
  const b = right as Record<string, unknown>;
  return keys.every((key) => Object.prototype.hasOwnProperty.call(b, key) && equivalentData(a[key], b[key], seen));
}

export class CalendarApp {
  private readonly store: Store<CalendarState>;
  private readonly views = new Map<string, CalendarView>();
  private readonly engine: ConstraintEngine;
  private readonly listeners = new Map<CalendarEventName, Set<(payload: unknown) => void>>();
  private readonly readyPromise: Promise<void>;
  private readonly memoExpand = memoize(expandRange);

  private eventSource: EventSource | undefined;
  private renderEvent: EventRenderSlot | undefined;
  private getDayStyle: import("../views/viewDef.js").DayStyleCallback | undefined;
  private renderEventMore: MonthMoreRenderSlot | undefined;
  private readonly onEventMoreClick: ((info: MonthMoreInfo) => void | false) | undefined;
  private renderMonthMore: MonthMoreRenderSlot | undefined;
  private readonly onMonthMoreClick: ((info: MonthMoreInfo) => void | false) | undefined;
  private renderToolbar: ToolbarRenderSlot | undefined;
  private readonly onEventClick: ((occurrence: EventOccurrence) => void) | undefined;
  private readonly onDateClick: ((dateISO: string, minuteOfDay?: number) => void) | undefined;
  private readonly onEventDrop: ((change: EventChange) => CommitResult) | undefined;
  private readonly onEventResize: ((change: EventChange) => CommitResult) | undefined;
  private readonly onDateSelect: ((selection: SelectionChange) => void) | undefined;
  private readonly onDropBlocked: ((info: BlockedInfo) => void) | undefined;
  private readonly onClickBlocked: ((info: BlockedInfo) => void) | undefined;

  private readonly interaction: InteractionEngine;
  private resources: readonly CalendarResource[];
  private hasResourceConfig: boolean;
  /** Índice das ocorrências do render atual (id do bloco → ocorrência), para a interação. */
  private occurrenceIndex = new Map<string, EventOccurrence>();
  /** Ocorrências do render atual (base da validação de ocupação). */
  private currentOccurrences: readonly EventOccurrence[] = [];
  /** Rascunho vivo do gesto (desenhado como fantasma). */
  private draft: InteractionDraft | null = null;

  private container: HTMLElement | null = null;
  private root: Root | null = null;
  private snapshot: ReactNode = null;

  getSnapshot(): ReactNode { return this.snapshot; }
  private unsubscribe: (() => void) | null = null;
  private temporal: TemporalLike | null = null;
  private dateUtils: DateUtils | null = null;
  private fetchToken = 0;
  private destroyed = false;
  private updateDepth = 0;
  private renderPending = false;
  private fetchPending = false;
  private readonly rejectedOptimistic = new WeakMap<CalendarEvent, CalendarEvent>();
  /** rAF pendente do render de rascunho (throttle do fantasma durante drag — ver scheduleDraftRender). */
  private draftRenderHandle: number | null = null;

  constructor(config: CalendarConfig = {}) {
    validateResources(config.resources);
    const options: CalendarOptions = { ...DEFAULT_OPTIONS, ...config.options };
    validateCalendarOptions(options);
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
    this.getDayStyle = config.getDayStyle;
    this.renderEventMore = config.renderEventMore;
    this.onEventMoreClick = config.onEventMoreClick;
    this.renderMonthMore = config.renderMonthMore;
    this.onMonthMoreClick = config.onMonthMoreClick;
    this.renderToolbar = config.renderToolbar;
    this.onEventClick = config.onEventClick;
    this.onDateClick = config.onDateClick;
    this.onEventDrop = config.onEventDrop;
    this.onEventResize = config.onEventResize;
    this.onDateSelect = config.onDateSelect;
    this.onDropBlocked = config.onDropBlocked;
    this.onClickBlocked = config.onClickBlocked;
    this.resources = config.resources ?? [];
    this.hasResourceConfig = config.resources !== undefined;
    this.interaction = this.createInteractionEngine();

    const temporalPromise = config.temporal
      ? Promise.resolve(config.temporal)
      : ensureTemporal();
    this.readyPromise = temporalPromise.then((resolvedTemporal) => {
      if (this.destroyed) return;
      this.temporal = resolvedTemporal;
      this.dateUtils = createDateUtils(resolvedTemporal);
      return this.runInitialFetch();
    });
  }

  // ---- ciclo de vida ---------------------------------------------------------

  /** Monta o calendário no container. Renderiza assim que Temporal + fetch inicial estiverem prontos. */
  mount(container: HTMLElement, options: { external?: boolean } = {}): void {
    if (this.destroyed) throw new Error('[meucalendario] calendário destruído');
    if (this.container === container) return;
    this.container?.removeEventListener('keydown', this.onGridKeyDown);
    if (this.root) flushSync(() => this.root!.unmount());
    this.root = options.external ? null : createRoot(container);
    this.container = container;
    container.addEventListener('keydown', this.onGridKeyDown);
    if (!this.unsubscribe) {
      this.unsubscribe = this.store.subscribe(() => this.renderNow());
    }
    // Delegação de Pointer Events no container (persiste entre re-renders do React).
    this.interaction.attach(container);
    void this.readyPromise.then(() => {
      if (this.snapshot === null) this.renderNow();
    }).catch((error: unknown) => {
      if (!this.destroyed) this.emit('error', error);
    });
  }

  /** Resolve quando Temporal + fetch inicial estão prontos e um primeiro render (se montado) ocorreu. */
  ready(): Promise<void> {
    return this.readyPromise.then(() => {
      if (this.container && this.snapshot === null) this.renderNow();
    });
  }

  destroy(): void {
    this.destroyed = true;
    ++this.fetchToken;
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.interaction.detach();
    this.cancelScheduledDraftRender();
    if (this.container) {
      this.container.removeEventListener('keydown', this.onGridKeyDown);
      if (this.root) flushSync(() => this.root!.unmount());
      this.root = null;
      this.snapshot = null;
      this.container = null;
    }
    this.listeners.clear();
  }

  /** Atualiza a lista de recursos usada pela validação DURA de ocupação. */
  setResources(resources: readonly CalendarResource[] | undefined): void {
    validateResources(resources);
    const hasConfig = resources !== undefined;
    const normalized = resources ?? [];
    if (hasConfig === this.hasResourceConfig && equivalentData(this.resources, normalized)) return;
    this.hasResourceConfig = hasConfig;
    this.resources = normalized;
    this.renderNow();
  }

  setEventSource(source: EventSource | undefined): void {
    if (this.eventSource === source) return;
    this.eventSource = source;
    ++this.fetchToken;
    this.refetch();
  }

  setRenderEvent(slot: EventRenderSlot | undefined): void {
    if (this.renderEvent === slot) return;
    this.renderEvent = slot;
    this.renderNow();
  }

  setDayStyle(callback: import("../views/viewDef.js").DayStyleCallback | undefined): void { if(this.getDayStyle===callback)return;this.getDayStyle=callback;this.renderNow(); }

  setRenderEventMore(slot: MonthMoreRenderSlot | undefined): void { if(this.renderEventMore===slot)return;this.renderEventMore=slot;this.renderNow(); }

  setRenderMonthMore(slot: MonthMoreRenderSlot | undefined): void {
    if (this.renderMonthMore === slot) return;
    this.renderMonthMore = slot;
    this.renderNow();
  }

  setRenderToolbar(slot: ToolbarRenderSlot | undefined): void {
    if (this.renderToolbar === slot) return;
    this.renderToolbar = slot;
    this.renderNow();
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
    if (this.store.getState().date === dateISO) return;
    this.store.setState({ date: dateISO });
    this.emit('dateChange', dateISO);
    this.emitRange();
    this.refetch();
  }

  changeView(viewName: string): void {
    if (!this.views.has(viewName)) {
      throw new Error(`[meucalendario] view não registrada: ${viewName}`);
    }
    if (this.store.getState().viewName === viewName) return;
    this.store.setState({ viewName });
    this.emit('viewChange', viewName);
    this.emitRange();
    this.refetch();
  }

  setEvents(events: readonly CalendarEvent[]): void {
    if (equivalentData(this.store.getState().events, events)) return;
    ++this.fetchToken;
    this.store.setState({ events });
  }

  setConstraints(constraints: ConstraintSet): void {
    if (equivalentData(this.store.getState().constraints, constraints)) return;
    this.engine.update(constraints);
    this.store.setState({ constraints });
  }

  setOptions(patch: Partial<CalendarOptions>): void {
    const previousOptions = this.store.getState().options;
    const previousRange = this.temporal ? this.getVisibleRange() : null;
    const options = { ...previousOptions, ...patch };
    validateCalendarOptions(options);
    if (equivalentData(this.store.getState().options, options)) return;
    this.store.setState({ options });
    const nextRange = this.temporal ? this.getVisibleRange() : null;
    if (previousOptions.timeZone !== options.timeZone || !equivalentData(previousRange, nextRange)) {
      this.emitRange();
      this.refetch();
    }
  }

  /** Toggle de visibilidade de recursos nas views de recurso (undefined = todos). */
  setVisibleResources(resourceIds: readonly string[] | undefined): void {
    this.setOptions({ visibleResourceIds: resourceIds });
  }

  /** Registra/subscreve view nova (1ª classe). */
  registerView(view: CalendarView): void {
    if (equivalentData(this.views.get(view.name), view)) return;
    this.views.set(view.name, view);
    this.renderNow();
  }

  /** Replace declarative custom views, including views removed by the consumer. */
  setViews(views: readonly CalendarView[]): void {
    const next = new Map(BUILTIN_VIEWS.map((view) => [view.name, view]));
    for (const view of views) next.set(view.name, view);
    if (next.size === this.views.size && [...next].every(([name, view]) => equivalentData(this.views.get(name), view))) return;
    this.views.clear();
    for (const [name, view] of next) this.views.set(name, view);
    if (!this.views.has(this.store.getState().viewName)) this.changeView('week');
    else {
      this.renderNow();
      this.refetch();
    }
  }

  /** Apply a declarative update as one snapshot and one request for its final range. */
  batchUpdate(update: () => void): void {
    this.updateDepth++;
    try {
      update();
    } finally {
      this.updateDepth--;
      if (this.updateDepth === 0) {
        const render = this.renderPending;
        const fetch = this.fetchPending;
        this.renderPending = false;
        this.fetchPending = false;
        if (render) this.renderNow();
        if (fetch) this.refetch();
      }
    }
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

  /** Evaluate creation or editing with the same resource rules used by pointer gestures. */
  evaluatePlacement(input: EvaluationInput): DraftEvaluation {
    return this.evaluateDraft(input);
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
    const occurrences: EventOccurrence[] = this.memoExpand(temporal, state.events, startISO, endISO, state.options.timeZone);
    const nowMs = state.options.nowMs ?? Date.now();

    // Índice para a interação (id do bloco → ocorrência) e base da validação de ocupação.
    this.currentOccurrences = occurrences;
    this.occurrenceIndex = new Map(
      occurrences.map((occurrence) => [occurrenceKey(occurrence), occurrence]),
    );

    const context: ViewRenderContext = {
      temporal,
      dateUtils: this.dateUtils!,
      options: state.options,
      range,
      occurrences,
      constraints: state.constraints,
      nowMs,
    };
    if (this.hasResourceConfig) context.resources = this.resources;
    if (this.draft) context.draft = this.draft;
    if (this.renderEvent) context.renderEvent = this.renderEvent;
    context.viewName=state.viewName;
    if(this.getDayStyle)context.getDayStyle=this.getDayStyle;
    if (this.renderEventMore) context.renderEventMore=this.renderEventMore;
    if (this.onEventMoreClick) context.onEventMoreClick=this.onEventMoreClick;
    if (this.renderMonthMore) context.renderMonthMore = this.renderMonthMore;
    if (this.onMonthMoreClick) context.onMonthMoreClick = this.onMonthMoreClick;
    context.openDateView = (dateISO,viewName) => this.batchUpdate(() => { this.setDate(dateISO); this.changeView(viewName); });
    if (this.onEventClick) context.onEventClick = this.onEventClick;
    if (this.onDateClick) context.onDateClick = (dateISO, minuteOfDay) => this.clickDate(dateISO, minuteOfDay);
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
    if (this.updateDepth > 0) { this.renderPending = true; return; }
    if (!this.temporal || !this.dateUtils || !this.container) return;
    const { view, range, context } = this.resolveView();
    const renderContext = this.buildRenderContext(range);
    const body = view.render(renderContext);
    const toolbar = this.buildToolbarContext(view, range, context);
    const tree = createElement(CalendarShell, {
        toolbar,
        body,
        ...(this.renderToolbar ? { renderToolbar: this.renderToolbar } : {}),
      });
    this.snapshot = tree;
    if (this.root) flushSync(() => this.root!.render(tree));
    this.emit('render', renderContext);
  }

  /** Agenda (no máx. 1 por frame) o render do rascunho vivo — ver `onDraftChange` acima. */
  private scheduleDraftRender(): void {
    if (this.draftRenderHandle !== null) return; // já agendado: pegará o `this.draft` mais recente
    this.draftRenderHandle = scheduleFrame(() => {
      this.draftRenderHandle = null;
      this.renderNow();
    });
  }

  /** Cancela um render de rascunho pendente (fim de gesto, destroy). */
  private cancelScheduledDraftRender(): void {
    if (this.draftRenderHandle === null) return;
    cancelFrame(this.draftRenderHandle);
    this.draftRenderHandle = null;
  }

  // ---- interação (Fase 4) ----------------------------------------------------

  /** Constrói o InteractionEngine ligado a este app (dados vivos + política de avaliação). */
  private createInteractionEngine(): InteractionEngine {
    return new InteractionEngine({
      getGridBounds: () => {
        const { options } = this.store.getState();
        return { startMin: resolveHour(options.startHour) * 60, endMin: resolveHour(options.endHour) * 60 };
      },
      getSlotMinutes: () => this.store.getState().options.slotMinutes,
      allowEventTypeChange:()=>this.store.getState().options.allowEventTypeChange===true,
      getMinDurationMin: () => this.store.getState().options.minEventMinutes,
      evaluate: (input) => this.evaluateDraft(input),
      resolveOccurrence: (eventId) => this.occurrenceIndex.get(eventId) ?? null,
      resolveSpan: (occurrence) => {
        const { time } = occurrence.event;
        if (time.allDay) return { dateISO: time.start.date!, startMin: 0, endDateISO: time.end.date!, endMin: 0, allDay: true };
        const zone = this.store.getState().options.timeZone;
        const start = this.temporal!.PlainDateTime.from(time.start.dateTime!).toZonedDateTime(time.start.timeZone ?? zone).withTimeZone(zone);
        const end = this.temporal!.PlainDateTime.from(time.end.dateTime!).toZonedDateTime(time.end.timeZone ?? zone).withTimeZone(zone);
        return { dateISO: start.toPlainDate().toString(), startMin: start.hour * 60 + start.minute,
          endDateISO: end.toPlainDate().toString(), endMin: end.hour * 60 + end.minute,
          durationMinutes: Number(end.epochMilliseconds - start.epochMilliseconds) / 60000 };
      },
      normalizeDraft: (draft, origin, kind) => {
        if (kind !== 'move' || draft.allDay || origin.durationMinutes === undefined) return draft;
        const start = this.temporal!.PlainDate.from(draft.dateISO).toPlainDateTime()
          .add({ minutes: draft.startMin }).toZonedDateTime(this.store.getState().options.timeZone);
        const end = start.add({ milliseconds: origin.durationMinutes * 60000 });
        const endDateISO = end.toPlainDate().toString();
        return { ...draft, endDateISO, endMin: end.hour * 60 + end.minute };
      },
      callbacks: {
        onDraftChange: (draft) => {
          this.draft = draft;
          if (draft === null) {
            // Fim do gesto (commit/revert/blocked/cancel): não há motivo pra esperar o próximo
            // frame — renderiza já e descarta qualquer render de rascunho ainda agendado, pra
            // nenhum render "atrasado" pisar em cima do estado final.
            this.cancelScheduledDraftRender();
            this.renderNow();
            return;
          }
          // Rascunho vivo (arrasto em andamento): `pointermove` bruto dispara MUITAS vezes por
          // segundo; sem throttle, cada um vira um `renderNow()` (React completo) síncrono +
          // `locateByRects` relendo `getBoundingClientRect()` de cada coluna — layout thrashing.
          // Coalesce em no máximo 1 render por frame, sempre com o rascunho mais recente.
          this.scheduleDraftRender();
        },
        commitMove: (change) => this.applyEventChange(change, this.onEventDrop),
        commitResize: (change) => this.applyEventChange(change, this.onEventResize),
        commitSelect: (selection) => this.onDateSelect?.(selection),
        clickEvent: (placement) => this.onEventClick?.(placement.occurrence),
        clickEmpty: (slot: PointerSlot) =>
          this.clickDate(slot.dateISO, slot.dateOnly || slot.allDay ? undefined : Math.floor(slot.minuteOfDay / this.store.getState().options.slotMinutes) * this.store.getState().options.slotMinutes, slot.resourceId),
        blocked: (info: BlockedInfo) => {
          const isSelection = info.kind === 'select';
          if (isSelection) this.onClickBlocked?.(info);
          else this.onDropBlocked?.(info);
        },
      },
    });
  }

  /** Avalia um candidato: ConstraintEngine (business/blocked/allowed) + ocupação de recurso. */
  private readonly onGridKeyDown = (event: KeyboardEvent): void => {
    if (!this.container || !this.temporal) return;
    keyboardGrid(event, this.container, (dateISO, startMin, endMin, resourceId) => {
      const input: EvaluationInput = { kind: 'select', dateISO, startMin, endMin, resourceId };
      const evaluation = this.evaluateDraft(input);
      if (!evaluation.valid) {
        this.onClickBlocked?.({ ...input, reason: evaluation.reason });
      } else if (this.onDateSelect) {
        this.onDateSelect({ dateISO, startMin, endMin, resourceId });
      } else {
        this.onDateClick?.(dateISO, startMin);
      }
    });
  };

  private clickDate(dateISO: string, minuteOfDay?: number, resourceId?: string): void {
    const startMin = minuteOfDay ?? 0;
    const endMin = minuteOfDay === undefined ? 1440 : Math.min(1440, startMin + this.store.getState().options.slotMinutes);
    const input: EvaluationInput = {kind:'select', dateISO, startMin, endMin,
      ...(minuteOfDay === undefined ? {allDay:true} : {}), ...(resourceId ? {resourceId} : {})};
    const evaluation = this.evaluateDraft(input);
    if (!evaluation.valid) { this.onClickBlocked?.({...input, reason:evaluation.reason}); return; }
    if (resourceId && this.onDateSelect) this.onDateSelect({dateISO,startMin,endMin:minuteOfDay === undefined ? 0 : endMin,resourceId,...(minuteOfDay === undefined ? {allDay:true,endDateISO:this.temporal!.PlainDate.from(dateISO).add({days:1}).toString()} : {})});
    else this.onDateClick?.(dateISO,minuteOfDay);
  }
  private evaluateDraft(input: EvaluationInput): DraftEvaluation {
    if (input.endDateISO !== undefined && this.temporal) {
      const start = this.temporal.PlainDate.from(input.dateISO);
      const end = this.temporal.PlainDate.from(input.endDateISO);
      const days = end.since(start).days;
      if (days < 0 || days > 3660 || (days === 0 && input.endMin <= input.startMin)) return { valid: false, reason: 'outside-allowed' };
      for (let index = 0; index <= days; index++) {
        const startMin = index === 0 ? input.startMin : 0;
        const endMin = index === days ? input.endMin : 1440;
        if (endMin <= startMin) continue;
        const evaluation = this.evaluateDay({ ...input, dateISO: start.add({ days: index }).toString(),
          endDateISO: undefined, startMin, endMin });
        if (!evaluation.valid) return evaluation;
      }
      return { valid: true, reason: 'ok' };
    }
    return this.evaluateDay(input);
  }

  private evaluateDay(input: EvaluationInput): DraftEvaluation {
    const slot: Slot = input.allDay ? { date: input.dateISO }
      : { date: input.dateISO, startMin: input.startMin, endMin: input.endMin };
    const targetResource =
      input.resourceId === undefined
        ? undefined
        : this.resources.find((candidate) => candidate.id === input.resourceId);
    const baseEvaluation = this.constraintEngineFor(targetResource).evaluate(slot);
    if (!baseEvaluation.valid) {
      const reason = (baseEvaluation.reason ?? 'blocked') as DraftReason;
      return { valid: false, reason };
    }
    const occurrence = input.occurrence;
    const canCheckOccupancy = this.temporal !== null && (occurrence !== undefined || input.resourceId !== undefined);
    if (canCheckOccupancy) {
      const resourceIds = occurrence ? this.resourceIdsAfterDrop(occurrence, input) : [input.resourceId!];
      for (const resourceId of resourceIds) {
        const resource = this.resources.find((candidate) => candidate.id === resourceId);
        if (!resource) continue;
        const occupancyResult = this.evaluateResourceOccupancy(resource.id, input);
        if (!occupancyResult.valid) return occupancyResult;
      }
    }
    return { valid: true, reason: 'ok' };
  }

  /**
   * Recursos que o evento passará a ocupar SE o candidato for aceito — o que a ocupação precisa
   * validar. Numa view de data é o conjunto atual; numa view de recurso é o conjunto atual com a
   * coluna de origem trocada pela de destino (mesma função que o commit aplica, para fantasma e
   * commit nunca discordarem). Um evento sala+profissional arrastado entre profissionais continua
   * sendo validado contra a sala.
   */
  private resourceIdsAfterDrop(
    occurrence: EventOccurrence,
    input: EvaluationInput,
  ): readonly string[] {
    const current = occurrence.event.resourceIds ?? [];
    if (input.resourceId === undefined) return current;
    if (input.fromResourceId === undefined) return [input.resourceId];
    return reassignResource(current, input.fromResourceId, input.resourceId);
  }

  /**
   * ConstraintEngine a usar na avaliação: o do calendário, ou um do RECURSO-alvo quando o gesto
   * veio de uma view de recurso. Sem isto o fantasma diria "válido" sobre a faixa que a própria
   * coluna desenha como fora do expediente (o sombreado usa `resourceConstraintSet`).
   * Instanciar por avaliação é O(1) (o construtor só guarda três arrays) e mantém o motor sempre
   * coerente com o `constraints`/`resources` do momento, sem cache para invalidar.
   */
  private constraintEngineFor(resource: CalendarResource | undefined): ConstraintEngine {
    if (!resource) return this.engine;
    const hasOwnRules = (resource.businessHours?.length ?? 0) > 0;
    if (!hasOwnRules) return this.engine;
    return new ConstraintEngine(
      resourceConstraintSet(resource, this.store.getState().constraints),
    );
  }

  /** Ocupação de UM recurso: concorrência (lotação) + buffers na nova posição do candidato. */
  private evaluateResourceOccupancy(resourceId: string, input: EvaluationInput): DraftEvaluation {
    const temporal = this.temporal!;
    const resource = this.resources.find((candidate) => candidate.id === resourceId)!;
    const movedId = input.occurrence ? occurrenceKey(input.occurrence) : '';
    const dayPlain = temporal.PlainDate.from(input.dateISO);
    const state = this.store.getState();
    const range = this.getVisibleRange();
    const isVisibleDate = input.dateISO >= range.start && input.dateISO <= range.end;
    const candidates = isVisibleDate ? this.currentOccurrences
      : expandRange(temporal, state.events, input.dateISO, input.dateISO, state.options.timeZone);
    const resourceOccurrences = occurrencesForResource(candidates, resourceId).filter(
      (occurrence) => occurrenceKey(occurrence) !== movedId,
    );
    // Dia inteiro (0..24) p/ não recortar ocupação pela janela visível do grid.
    const dayData = buildDays(
      temporal,
      [dayPlain],
      resourceOccurrences,
      {},
      { startHour: 0, endHour: 24 },
      this.store.getState().options.timeZone,
    )[0]!;
    const busy = dayData.timed.map((placement) => ({
      startMin: placement.startMin,
      endMin: placement.endMin,
    }));
    dayData.allDay.forEach(() => busy.push({ startMin: 0, endMin: 1440 }));
    const occupancy: ResourceOccupancy = {
      capacity: resource.capacity===false ? Infinity : resource.capacity ?? (state.options.defaultResourceCapacity===false ? Infinity : state.options.defaultResourceCapacity ?? 1),
      bufferBefore: resource.bufferBefore ?? 0,
      bufferAfter: resource.bufferAfter ?? 0,
      busy,
    };
    return validateOccupancy({ startMin: input.startMin, endMin: input.endMin }, occupancy);
  }

  /**
   * Commit otimista de mover/redimensionar: aplica a mudança no store e chama o callback.
   * Se o callback retornar `false` ou rejeitar, REVERTE ao estado anterior (revert em falha).
   */
  private applyEventChange(
    change: EventChange,
    callback: ((change: EventChange) => CommitResult) | undefined,
  ): void {
    change.timeZone = this.store.getState().options.timeZone;
    const previousEvents = this.store.getState().events;
    const nextEvents = applyEventTimeChange(previousEvents, change);
    this.setEvents(nextEvents);
    if (!callback) return;
    // Revert only optimistic objects still owned by this operation. Newer edits
    // and updates of other events must survive an older rejection.
    const originals = new Map<CalendarEvent, CalendarEvent>();
    nextEvents.forEach((event, index) => {
      if (event !== previousEvents[index]) originals.set(event, previousEvents[index]!);
    });
    const rollback = (): void => {
      if (this.destroyed) return;
      for (const [optimistic, original] of originals) this.rejectedOptimistic.set(optimistic, original);
      const current = this.store.getState().events;
      const restored = current.map((event) => {
        let restoredEvent = originals.get(event) ?? event;
        const visited = new Set<CalendarEvent>();
        while (this.rejectedOptimistic.has(restoredEvent) && !visited.has(restoredEvent)) {
          visited.add(restoredEvent);
          restoredEvent = this.rejectedOptimistic.get(restoredEvent)!;
        }
        return restoredEvent;
      });
      if (restored.some((event, index) => event !== current[index])) this.setEvents(restored);
    };
    let result: CommitResult;
    try {
      result = callback(change);
    } catch {
      rollback();
      return;
    }
    void Promise.resolve(result)
      .then((outcome) => {
        const rejected = outcome === false;
        if (rejected) rollback();
      })
      .catch(rollback);
  }

  /** Busca inicial (parte do readyPromise, para que `ready()` aguarde os eventos). */
  private runInitialFetch(): void | Promise<void> {
    if (!this.eventSource || this.destroyed) return;
    const token = ++this.fetchToken;
    const range = this.getVisibleRange();
    const source = this.eventSource;
    return Promise.resolve().then(() => {
      if (this.destroyed || token !== this.fetchToken) return undefined;
      return source(range);
    }).then((events) => {
      const isLatestFetch = token === this.fetchToken;
      if (isLatestFetch && events !== undefined && !equivalentData(this.store.getState().events, events)) this.store.setState({ events });
    }).catch((error: unknown) => {
      if (token === this.fetchToken && !this.destroyed) this.emit('error', error);
    });
  }

  /** Refetch por mudança de range (assíncrono; ignora resultados obsoletos). Público p/ `refetchKey`. */
  refetch(): void {
    if (this.updateDepth > 0) { this.fetchPending = true; return; }
    if (!this.eventSource || !this.temporal || this.destroyed) return;
    const token = ++this.fetchToken;
    const range = this.getVisibleRange();
    const source = this.eventSource;
    void Promise.resolve().then(() => {
      if (this.destroyed || token !== this.fetchToken) return undefined;
      return source(range);
    }).then((events) => {
      const isLatestFetch = token === this.fetchToken;
      if (isLatestFetch && events !== undefined && !equivalentData(this.store.getState().events, events)) this.store.setState({ events });
    }).catch((error: unknown) => {
      if (token === this.fetchToken && !this.destroyed) this.emit('error', error);
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
