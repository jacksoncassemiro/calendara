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

import { expandRange, occurrenceKey } from '../../core/index.js';
import { resourceBusyIntervals } from '../../core/render/derive.js';
import { occurrencesForResource, resourceConstraintSet } from '../../core/index.js';
import { InteractionEngine, type EvaluationInput, type DraftEvaluation } from '../../core/index.js';
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

import { createViewRegistry } from '../views/registry/createViewRegistry.js';
import { CalendarShell } from '../components/CalendarShell.js';
import {
  registerExternalDragReceiver,
  type ExternalEventDropHandler,
  type EventDropOutsideInfo,
} from '../externalDrag.js';
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
  DayStyleCallback,
} from '../viewTypes.js';

type PlainDate = InstanceType<TemporalLike['PlainDate']>;

export type CalendarEventName =
  'render' | 'dateChange' | 'viewChange' | 'rangeChange' | 'loadingChange' | 'error';

export interface RangeChange {
  start: string;
  end: string;
}

/** Pass signal to fetch or another abort-aware client to cancel obsolete requests. */
export interface EventSourceContext {
  signal: AbortSignal;
}

/** Fonte de eventos por range (expansão lazy). Pode ser síncrona ou assíncrona. */
export type EventSource = (
  range: RangeChange,
  context: EventSourceContext,
) => CalendarEvent[] | Promise<CalendarEvent[]>;

export interface CalendarConfig {
  /** Used only during construction; date takes precedence when both are present. */
  initialDate?: string;
  /** Used only during construction; view takes precedence when both are present. */
  initialView?: string;
  date?: string;
  view?: string;
  events?: CalendarEvent[];
  constraints?: ConstraintSet;
  options?: Partial<CalendarOptions>;
  /** Complete, nonempty available view selection. @remarks Português: Seleção explícita, não vazia. */
  views: readonly CalendarView[];
  /** Injeta Temporal já resolvido (testes/SSR). Ausente → carrega via ensureTemporal(). */
  temporal?: TemporalLike;
  /** Busca eventos por range visível (dispara em cada mudança de range). */
  eventSource?: EventSource;
  /** Slot para conteúdo customizado de evento. */
  renderEvent?: EventRenderSlot;
  renderMonthMore?: MonthMoreRenderSlot;
  renderEventMore?: MonthMoreRenderSlot;
  getDayStyle?: DayStyleCallback;
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
  onExternalEventDrop?: ExternalEventDropHandler;
  onEventDropOutside?: (info: EventDropOutsideInfo) => void | Promise<void>;
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
    if (typeof resource.id !== 'string' || resource.id.length === 0 || ids.has(resource.id))
      throw new RangeError('[meucalendario] id de recurso vazio ou duplicado');
    ids.add(resource.id);
    if (
      resource.capacity !== undefined &&
      resource.capacity !== false &&
      (!Number.isSafeInteger(resource.capacity) || resource.capacity <= 0)
    )
      throw new RangeError('[meucalendario] capacity deve ser inteiro positivo');
    for (const buffer of [resource.bufferBefore, resource.bufferAfter]) {
      if (buffer !== undefined && (!Number.isFinite(buffer) || buffer < 0))
        throw new RangeError('[meucalendario] buffer deve ser finito e não negativo');
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
function equivalentData(
  left: unknown,
  right: unknown,
  seen = new WeakMap<object, WeakSet<object>>(),
): boolean {
  if (Object.is(left, right)) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object')
    return false;
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
  const leftProperties = left as Record<string, unknown>;
  const rightProperties = right as Record<string, unknown>;
  return keys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(rightProperties, key) &&
      equivalentData(leftProperties[key], rightProperties[key], seen),
  );
}

export class CalendarApp {
  private readonly store: Store<CalendarState>;
  private readonly views = new Map<string, CalendarView>();
  private readonly engine: ConstraintEngine;
  private readonly listeners = new Map<CalendarEventName, Set<(payload: unknown) => void>>();
  private readonly readyPromise: Promise<void>;
  private readonly memoExpand = memoize(expandRange);
  private readonly memoBufferExpand = memoize(expandRange);
  private readonly memoOccupancyExpand = memoize(expandRange);

  private eventSource: EventSource | undefined;
  private renderEvent: EventRenderSlot | undefined;
  private getDayStyle: DayStyleCallback | undefined;
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
  private onExternalEventDrop: ExternalEventDropHandler | undefined;
  private onEventDropOutside: CalendarConfig['onEventDropOutside'];
  private unregisterExternalReceiver: (() => void) | undefined;
  private resources: readonly CalendarResource[];
  private hasResourceConfig: boolean;
  /** Índice das ocorrências do render atual (id do bloco → ocorrência), para a interação. */
  private occurrenceIndex = new Map<string, EventOccurrence>();
  /** Ocorrências do render atual (base da validação de ocupação). */
  /** Rascunho vivo do gesto (desenhado como fantasma). */
  private draft: InteractionDraft | null = null;

  private container: HTMLElement | null = null;
  private root: Root | null = null;
  private snapshot: ReactNode = null;

  getSnapshot(): ReactNode {
    return this.snapshot;
  }
  private unsubscribe: (() => void) | null = null;
  private temporal: TemporalLike | null = null;
  private dateUtils: DateUtils | null = null;
  private fetchToken = 0;
  private fetchController: AbortController | null = null;
  private loading = false;
  private needsInitialDateResolution = false;
  private destroyed = false;
  private updateDepth = 0;
  private renderPending = false;
  private fetchPending = false;
  private rangePending = false;
  private readonly rejectedOptimistic = new WeakMap<CalendarEvent, CalendarEvent>();
  /** rAF pendente do render de rascunho (throttle do fantasma durante drag — ver scheduleDraftRender). */
  private draftRenderHandle: number | null = null;

  constructor(config: CalendarConfig) {
    const viewRegistry = createViewRegistry(config.views);
    validateResources(config.resources);
    const options: CalendarOptions = { ...DEFAULT_OPTIONS, ...config.options };
    validateCalendarOptions(options);
    this.needsInitialDateResolution = config.date === undefined && config.initialDate === undefined;
    const initialState: CalendarState = {
      date: config.date ?? config.initialDate ?? this.localTodayISO(options.nowMs ?? Date.now()),
      viewName: config.view ?? config.initialView ?? config.views[0]!.name,
      events: config.events ?? [],
      constraints: config.constraints ?? {},
      options,
    };
    this.store = createStore(initialState);
    for (const [name, view] of viewRegistry) this.views.set(name, view);
    if (!this.views.has(initialState.viewName)) {
      throw new Error(`[meucalendario] view não registrada: ${initialState.viewName}`);
    }
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
    this.onExternalEventDrop = config.onExternalEventDrop;
    this.onEventDropOutside = config.onEventDropOutside;
    this.onEventResize = config.onEventResize;
    this.onDateSelect = config.onDateSelect;
    this.onDropBlocked = config.onDropBlocked;
    this.onClickBlocked = config.onClickBlocked;
    this.resources = config.resources ?? [];
    this.hasResourceConfig = config.resources !== undefined;
    this.interaction = this.createInteractionEngine();

    const temporalPromise = config.temporal ? Promise.resolve(config.temporal) : ensureTemporal();
    this.readyPromise = temporalPromise.then((resolvedTemporal) => {
      if (this.destroyed) return;
      this.temporal = resolvedTemporal;
      this.dateUtils = createDateUtils(resolvedTemporal);
      if (this.needsInitialDateResolution) {
        this.needsInitialDateResolution = false;
        this.store.setState({ date: this.todayISO() });
      }
      this.emit('dateChange', this.store.getState().date);
      this.emit('viewChange', this.store.getState().viewName);
      this.emitRange();
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
    this.unregisterExternalReceiver?.();
    this.unregisterExternalReceiver = registerExternalDragReceiver(container, {
      canReceive: (clientX, clientY) =>
        Boolean(
          this.onExternalEventDrop &&
          this.temporal &&
          this.interaction.locatePointerSlot(clientX, clientY),
        ),
      start: (event, pointer) => this.startExternalEvent(event, pointer),
      cancel: () => this.interaction.cancelDrag(),
    });
    void this.readyPromise
      .then(() => {
        if (this.snapshot === null) this.renderNow();
      })
      .catch((error: unknown) => {
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
    this.cancelFetch();
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.interaction.detach();
    this.unregisterExternalReceiver?.();
    this.unregisterExternalReceiver = undefined;
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
    this.cancelFetch();
    if (!source) this.setLoading(false);
    this.refetch();
  }

  setRenderEvent(slot: EventRenderSlot | undefined): void {
    if (this.renderEvent === slot) return;
    this.renderEvent = slot;
    this.renderNow();
  }

  setDayStyle(callback: DayStyleCallback | undefined): void {
    if (this.getDayStyle === callback) return;
    this.getDayStyle = callback;
    this.renderNow();
  }

  setRenderEventMore(slot: MonthMoreRenderSlot | undefined): void {
    if (this.renderEventMore === slot) return;
    this.renderEventMore = slot;
    this.renderNow();
  }

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
    this.needsInitialDateResolution = false;
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
    this.cancelFetch();
    this.setLoading(false);
    this.store.setState({ events });
  }

  setConstraints(constraints: ConstraintSet): void {
    if (equivalentData(this.store.getState().constraints, constraints)) return;
    this.engine.update(constraints);
    this.store.setState({ constraints });
  }

  setOptions(patch: Partial<CalendarOptions>): void {
    this.applyOptions({ ...this.store.getState().options, ...patch });
  }

  /** Declarative options reset omitted keys to their defaults. */
  replaceOptions(options: Partial<CalendarOptions> | undefined): void {
    this.applyOptions({ ...DEFAULT_OPTIONS, ...options });
  }

  private applyOptions(options: CalendarOptions): void {
    const previousOptions = this.store.getState().options;
    const previousRange = this.temporal ? this.getVisibleRange() : null;
    validateCalendarOptions(options);
    if (equivalentData(this.store.getState().options, options)) return;
    this.store.setState({ options });
    const nextRange = this.temporal ? this.getVisibleRange() : null;
    if (
      previousOptions.timeZone !== options.timeZone ||
      !equivalentData(previousRange, nextRange)
    ) {
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
    createViewRegistry([view]);
    if (equivalentData(this.views.get(view.name), view)) return;
    const previousRange = this.temporal ? this.getVisibleRange() : null;
    this.views.set(view.name, view);
    this.renderNow();
    this.refetchChangedRange(previousRange);
  }

  /** Replace the complete, nonempty available view selection. */
  setViews(configuredViews: readonly CalendarView[]): void {
    const next = createViewRegistry(configuredViews);
    const previousViews = [...this.views.values()];
    if (
      next.size === this.views.size &&
      configuredViews.every((view, index) => equivalentData(previousViews[index], view))
    )
      return;
    const previousRange = this.temporal ? this.getVisibleRange() : null;
    const previousViewName = this.store.getState().viewName;
    this.views.clear();
    for (const [name, view] of next) this.views.set(name, view);
    if (!this.views.has(previousViewName)) {
      const viewName = configuredViews[0]!.name;
      this.store.setState({ viewName });
      this.emit('viewChange', viewName);
    }
    this.renderNow();
    this.refetchChangedRange(previousRange);
  }

  private refetchChangedRange(previousRange: RangeChange | null): void {
    if (!this.temporal) return;
    if (!equivalentData(previousRange, this.getVisibleRange())) {
      this.emitRange();
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
        const range = this.rangePending;
        this.renderPending = false;
        this.fetchPending = false;
        this.rangePending = false;
        if (render) this.renderNow();
        if (range) this.emitRange();
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

  /** Validate an editor candidate against the same constraints and occupancy as gestures. */
  evaluateEvent(event: CalendarEvent, occurrence?: EventOccurrence): DraftEvaluation {
    if (!this.temporal) {
      throw new Error('[meucalendario] evaluateEvent requer o calendário pronto; aguarde ready().');
    }
    const candidateOccurrence: EventOccurrence = occurrence
      ? { ...occurrence, event }
      : {
          event,
          masterId: event.id,
          isMaster: true,
          originalStart: event.time.allDay ? event.time.start.date! : event.time.start.dateTime!,
        };
    const span = this.resolveOccurrenceSpan(candidateOccurrence);
    return this.evaluateDraft({
      ...span,
      kind: occurrence ? 'move' : 'select',
      occurrence: candidateOccurrence,
    });
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
    const view = this.views.get(state.viewName)!;
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
    const occurrences: EventOccurrence[] = this.memoExpand(
      temporal,
      state.events,
      startISO,
      endISO,
      state.options.timeZone,
    );
    const nowMs = state.options.nowMs ?? Date.now();

    // Índice para a interação (id do bloco → ocorrência) e base da validação de ocupação.
    this.occurrenceIndex = new Map(
      occurrences.map((occurrence) => [occurrenceKey(occurrence), occurrence]),
    );

    const context: ViewRenderContext = {
      referenceDateISO: state.date,
      temporal,
      dateUtils: this.dateUtils!,
      options: state.options,
      range,
      occurrences,
      constraints: state.constraints,
      nowMs,
    };
    if (this.hasResourceConfig) context.resources = this.resources;
    const bufferPaddingDays = Math.ceil(
      Math.max(
        0,
        ...this.resources.map(
          (resource) => (resource.bufferBefore ?? 0) + (resource.bufferAfter ?? 0),
        ),
      ) / 1440,
    );
    if (bufferPaddingDays > 0)
      context.resourceBufferOccurrences = this.memoBufferExpand(
        temporal,
        state.events,
        range.startDate.subtract({ days: bufferPaddingDays }).toString(),
        range.endDate.add({ days: bufferPaddingDays }).toString(),
        state.options.timeZone,
      );
    if (this.draft) context.draft = this.draft;
    if (this.renderEvent) context.renderEvent = this.renderEvent;
    context.viewName = state.viewName;
    if (this.getDayStyle) context.getDayStyle = this.getDayStyle;
    if (this.renderEventMore) context.renderEventMore = this.renderEventMore;
    if (this.onEventMoreClick) context.onEventMoreClick = this.onEventMoreClick;
    if (this.renderMonthMore) context.renderMonthMore = this.renderMonthMore;
    if (this.onMonthMoreClick) context.onMonthMoreClick = this.onMonthMoreClick;
    context.openDateView = (dateISO, viewName) =>
      this.batchUpdate(() => {
        this.setDate(dateISO);
        this.changeView(viewName);
      });
    if (this.onEventClick) context.onEventClick = this.onEventClick;
    if (this.onDateClick)
      context.onDateClick = (dateISO, minuteOfDay) => this.clickDate(dateISO, minuteOfDay);
    return context;
  }

  private buildToolbarContext(
    view: CalendarView,
    range: ViewRange,
    context: ViewContext,
  ): ToolbarContext {
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
    if (this.destroyed) return;
    if (this.updateDepth > 0) {
      this.renderPending = true;
      return;
    }
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

  setExternalDragCallbacks(
    receive: ExternalEventDropHandler | undefined,
    outside: CalendarConfig['onEventDropOutside'],
  ): void {
    this.onExternalEventDrop = receive;
    this.onEventDropOutside = outside;
  }

  private startExternalEvent(event: CalendarEvent, pointer: PointerEvent): boolean {
    if (!this.temporal || !this.onExternalEventDrop || event.recurrence || event.editable === false)
      return false;
    if (this.store.getState().events.some((existing) => existing.id === event.id)) return false;
    const occurrence: EventOccurrence = {
      event,
      masterId: event.id,
      isMaster: true,
      originalStart: event.time.allDay ? event.time.start.date! : event.time.start.dateTime!,
    };
    try {
      const span = this.resolveOccurrenceSpan(occurrence);
      return this.interaction.startExternalDrag(
        { ...span, occurrence, eventId: occurrenceKey(occurrence), editable: true },
        pointer,
      );
    } catch (error) {
      this.emit('error', error);
      return false;
    }
  }

  private resolveOccurrenceSpan(occurrence: EventOccurrence) {
    const { time } = occurrence.event;
    if (time.allDay)
      return {
        dateISO: time.start.date!,
        startMin: 0,
        endDateISO: time.end.date!,
        endMin: 0,
        allDay: true,
      };
    const zone = this.store.getState().options.timeZone;
    const start = this.temporal!.PlainDateTime.from(time.start.dateTime!)
      .toZonedDateTime(time.start.timeZone ?? zone)
      .withTimeZone(zone);
    const end = this.temporal!.PlainDateTime.from(time.end.dateTime!)
      .toZonedDateTime(time.end.timeZone ?? zone)
      .withTimeZone(zone);
    return {
      dateISO: start.toPlainDate().toString(),
      startMin: start.hour * 60 + start.minute,
      endDateISO: end.toPlainDate().toString(),
      endMin: end.hour * 60 + end.minute,
      durationMinutes: Number(end.epochMilliseconds - start.epochMilliseconds) / 60000,
    };
  }

  private notifyExternalDrop(change: EventChange): void {
    change.timeZone = this.store.getState().options.timeZone;
    const receivedEvent = applyEventTimeChange([change.event], change)[0]!;
    receivedEvent.resourceIds = [...this.resourceIdsAfterDrop(change.occurrence, change)];
    change.event = receivedEvent;
    this.runTransferCallback(() => this.onExternalEventDrop?.(change));
  }

  private runTransferCallback(callback: () => void | Promise<void>): void {
    try {
      Promise.resolve(callback()).catch((error: unknown) => {
        if (!this.destroyed) this.emit('error', error);
      });
    } catch (error) {
      this.emit('error', error);
    }
  }

  /** Constrói o InteractionEngine ligado a este app (dados vivos + política de avaliação). */
  private createInteractionEngine(): InteractionEngine {
    return new InteractionEngine({
      getGridBounds: () => {
        const { options } = this.store.getState();
        return {
          startMin: resolveHour(options.startHour) * 60,
          endMin: resolveHour(options.endHour) * 60,
        };
      },
      getSlotMinutes: () => this.store.getState().options.slotMinutes,
      allowEventTypeChange: () => this.store.getState().options.allowEventTypeChange === true,
      autoScroll: () => this.store.getState().options.autoScroll !== false,
      allowOutsideDrop: () => Boolean(this.onEventDropOutside),
      getMinDurationMin: () => this.store.getState().options.minEventMinutes,
      evaluate: (input) => this.evaluateDraft(input),
      resolveOccurrence: (eventId) => this.occurrenceIndex.get(eventId) ?? null,
      resolveSpan: (occurrence) => this.resolveOccurrenceSpan(occurrence),
      normalizeDraft: (draft, origin, kind) => {
        if (kind !== 'move' || draft.allDay || origin.durationMinutes === undefined) return draft;
        const start = this.temporal!.PlainDate.from(draft.dateISO)
          .toPlainDateTime()
          .add({ minutes: draft.startMin })
          .toZonedDateTime(this.store.getState().options.timeZone);
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
        commitExternal: (change) => this.notifyExternalDrop(change),
        dropOutside: (placement, target) => {
          if (this.onEventDropOutside)
            this.runTransferCallback(() =>
              this.onEventDropOutside?.({ ...target, occurrence: placement.occurrence }),
            );
        },
        commitResize: (change) => this.applyEventChange(change, this.onEventResize),
        commitSelect: (selection) => this.onDateSelect?.(selection),
        clickEvent: (placement) => this.onEventClick?.(placement.occurrence),
        clickEmpty: (slot: PointerSlot) =>
          this.clickDate(
            slot.dateISO,
            slot.dateOnly || slot.allDay
              ? undefined
              : Math.floor(slot.minuteOfDay / this.store.getState().options.slotMinutes) *
                  this.store.getState().options.slotMinutes,
            slot.resourceId,
          ),
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
    const endMin =
      minuteOfDay === undefined
        ? 1440
        : Math.min(1440, startMin + this.store.getState().options.slotMinutes);
    const input: EvaluationInput = {
      kind: 'select',
      dateISO,
      startMin,
      endMin,
      ...(minuteOfDay === undefined ? { allDay: true } : {}),
      ...(resourceId ? { resourceId } : {}),
    };
    const evaluation = this.evaluateDraft(input);
    if (!evaluation.valid) {
      this.onClickBlocked?.({ ...input, reason: evaluation.reason });
      return;
    }
    if (resourceId && this.onDateSelect)
      this.onDateSelect({
        dateISO,
        startMin,
        endMin: minuteOfDay === undefined ? 0 : endMin,
        resourceId,
        ...(minuteOfDay === undefined
          ? {
              allDay: true,
              endDateISO: this.temporal!.PlainDate.from(dateISO).add({ days: 1 }).toString(),
            }
          : {}),
      });
    else this.onDateClick?.(dateISO, minuteOfDay);
  }
  private evaluateDraft(input: EvaluationInput): DraftEvaluation {
    if (input.endDateISO !== undefined && this.temporal) {
      const start = this.temporal.PlainDate.from(input.dateISO);
      const end = this.temporal.PlainDate.from(input.endDateISO);
      const days = end.since(start).days;
      if (days < 0 || days > 3660 || (days === 0 && input.endMin <= input.startMin))
        return { valid: false, reason: 'outside-allowed' };
      for (let index = 0; index <= days; index++) {
        const startMin = index === 0 ? input.startMin : 0;
        const endMin = index === days ? input.endMin : 1440;
        if (endMin <= startMin) continue;
        const evaluation = this.evaluateDay({
          ...input,
          dateISO: start.add({ days: index }).toString(),
          endDateISO: undefined,
          startMin,
          endMin,
        });
        if (!evaluation.valid) return evaluation;
      }
      return { valid: true, reason: 'ok' };
    }
    return this.evaluateDay(input);
  }

  private evaluateDay(input: EvaluationInput): DraftEvaluation {
    const slot: Slot = input.allDay
      ? { date: input.dateISO }
      : { date: input.dateISO, startMin: input.startMin, endMin: input.endMin };
    const occurrence = input.occurrence;
    const resourceIds = occurrence
      ? this.resourceIdsAfterDrop(occurrence, input)
      : input.resourceId === undefined
        ? []
        : [input.resourceId];
    const applicableResources =
      resourceIds.length > 0
        ? resourceIds.map((resourceId) =>
            this.resources.find((resource) => resource.id === resourceId),
          )
        : [undefined];
    for (const resource of applicableResources) {
      const evaluation = this.constraintEngineFor(resource).evaluate(slot);
      if (!evaluation.valid) {
        return { valid: false, reason: (evaluation.reason ?? 'blocked') as DraftReason };
      }
    }
    const canCheckOccupancy =
      this.temporal !== null && (occurrence !== undefined || input.resourceId !== undefined);
    if (canCheckOccupancy) {
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
    if (input.fromResourceId === undefined) return [...new Set([...current, input.resourceId])];
    return reassignResource(current, input.fromResourceId, input.resourceId);
  }

  /**
   * Resolve the same effective global and resource rules used by background bands.
   * Each resource assigned to an event is evaluated, including in ordinary date views.
   */
  private constraintEngineFor(resource: CalendarResource | undefined): ConstraintEngine {
    if (!resource) return this.engine;
    return new ConstraintEngine(resourceConstraintSet(resource, this.store.getState().constraints));
  }

  /** Ocupação de UM recurso: concorrência (lotação) + buffers na nova posição do candidato. */
  private evaluateResourceOccupancy(resourceId: string, input: EvaluationInput): DraftEvaluation {
    const temporal = this.temporal!;
    const resource = this.resources.find((candidate) => candidate.id === resourceId)!;
    const movedId = input.occurrence ? occurrenceKey(input.occurrence) : '';
    const dayPlain = temporal.PlainDate.from(input.dateISO);
    const state = this.store.getState();
    // Both the existing reservation and candidate acquire buffers. Fetch the
    // neighbouring dates before clipping; a 23:50 end can occupy tomorrow.
    const bufferDays = Math.ceil(
      ((resource.bufferBefore ?? 0) + (resource.bufferAfter ?? 0)) / 1440,
    );
    const candidates = this.memoOccupancyExpand(
      temporal,
      state.events,
      dayPlain.subtract({ days: bufferDays }).toString(),
      dayPlain.add({ days: bufferDays }).toString(),
      state.options.timeZone,
    );
    const resourceOccurrences = occurrencesForResource(candidates, resourceId).filter(
      (occurrence) => occurrenceKey(occurrence) !== movedId,
    );
    const busy = resourceBusyIntervals(
      temporal,
      dayPlain,
      resourceOccurrences,
      state.options.timeZone,
    );
    const occupancy: ResourceOccupancy = {
      capacity:
        resource.capacity === false
          ? Infinity
          : (resource.capacity ??
            (state.options.defaultResourceCapacity === false
              ? Infinity
              : (state.options.defaultResourceCapacity ?? 1))),
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
      for (const [optimistic, original] of originals)
        this.rejectedOptimistic.set(optimistic, original);
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

  /** Initial request belongs to ready(), while navigation requests run independently. */
  private runInitialFetch(): void | Promise<void> {
    return this.fetchEvents();
  }

  /** Refetch the final visible range, cancelling any superseded request. */
  refetch(): void {
    if (this.updateDepth > 0) {
      this.fetchPending = true;
      return;
    }
    void this.fetchEvents();
  }

  private cancelFetch(): void {
    ++this.fetchToken;
    this.fetchController?.abort();
    this.fetchController = null;
  }

  private setLoading(loading: boolean): void {
    if (this.loading === loading) return;
    this.loading = loading;
    if (!this.destroyed) this.emit('loadingChange', loading);
  }

  private fetchEvents(): void | Promise<void> {
    if (!this.eventSource || !this.temporal || this.destroyed) return;
    this.cancelFetch();
    const token = this.fetchToken;
    const controller = new AbortController();
    this.fetchController = controller;
    const range = this.getVisibleRange();
    const source = this.eventSource;
    this.setLoading(true);
    const isCurrentRequest = (): boolean =>
      !this.destroyed && token === this.fetchToken && !controller.signal.aborted;
    return Promise.resolve()
      .then(() => {
        if (!isCurrentRequest()) return undefined;
        return source(range, { signal: controller.signal });
      })
      .then((events) => {
        if (
          isCurrentRequest() &&
          events !== undefined &&
          !equivalentData(this.store.getState().events, events)
        ) {
          this.store.setState({ events });
        }
      })
      .catch((error: unknown) => {
        if (isCurrentRequest()) this.emit('error', error);
      })
      .finally(() => {
        if (!isCurrentRequest()) return;
        this.fetchController = null;
        this.setLoading(false);
      });
  }

  private emit(eventName: CalendarEventName, payload: unknown): void {
    const listenerSet = this.listeners.get(eventName);
    if (!listenerSet) return;
    for (const callback of [...listenerSet]) callback(payload);
  }

  private emitRange(): void {
    if (this.updateDepth > 0) {
      this.rangePending = true;
      return;
    }
    if (!this.temporal) return;
    this.emit('rangeChange', this.getVisibleRange());
  }

  private todayISO(): string {
    const options = this.store.getState().options;
    const nowMs = options.nowMs ?? Date.now();
    if (this.temporal) {
      return this.temporal.Instant.fromEpochMilliseconds(nowMs)
        .toZonedDateTimeISO(options.timeZone)
        .toPlainDate()
        .toString();
    }
    return this.localTodayISO(nowMs);
  }

  private localTodayISO(nowMs = Date.now()): string {
    const now = new Date(nowMs);
    return `${now.getFullYear()}-${padTwo(now.getMonth() + 1)}-${padTwo(now.getDate())}`;
  }
}
