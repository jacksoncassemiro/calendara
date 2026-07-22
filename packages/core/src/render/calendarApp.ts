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
import type { CalendarResource } from '../types/resource.js';

import { expandRange, buildDays } from './derive.js';
import { occurrencesForResource } from './resourceDerive.js';
import {
  InteractionEngine,
  type EvaluationInput,
  type DraftEvaluation,
} from '../interaction/interactionEngine.js';
import {
  applyEventTimeChange,
  validateOccupancy,
  type InteractionDraft,
  type DraftReason,
  type EventChange,
  type SelectionChange,
  type BlockedInfo,
  type PointerSlot,
  type PlacementInfo,
  type ResourceOccupancy,
  type CommitResult,
} from '../interaction/index.js';
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

/** Chave estável de uma ocorrência (mesmo formato dos blocos de evento no DOM). */
function occurrenceKey(occurrence: EventOccurrence): string {
  return `${occurrence.masterId}@${occurrence.originalStart}`;
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
  private readonly onEventDrop: ((change: EventChange) => CommitResult) | undefined;
  private readonly onEventResize: ((change: EventChange) => CommitResult) | undefined;
  private readonly onDateSelect: ((selection: SelectionChange) => void) | undefined;
  private readonly onDropBlocked: ((info: BlockedInfo) => void) | undefined;
  private readonly onClickBlocked: ((info: BlockedInfo) => void) | undefined;

  private readonly interaction: InteractionEngine;
  private resources: readonly CalendarResource[];
  /** Índice das ocorrências do render atual (id do bloco → ocorrência), para a interação. */
  private occurrenceIndex = new Map<string, EventOccurrence>();
  /** Ocorrências do render atual (base da validação de ocupação). */
  private currentOccurrences: readonly EventOccurrence[] = [];
  /** Rascunho vivo do gesto (desenhado como fantasma). */
  private draft: InteractionDraft | null = null;

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
    this.onEventDrop = config.onEventDrop;
    this.onEventResize = config.onEventResize;
    this.onDateSelect = config.onDateSelect;
    this.onDropBlocked = config.onDropBlocked;
    this.onClickBlocked = config.onClickBlocked;
    this.resources = config.resources ?? [];
    this.interaction = this.createInteractionEngine();

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
    // Delegação de Pointer Events no container (persiste entre re-renders do Preact).
    this.interaction.attach(container);
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
    this.interaction.detach();
    if (this.container) {
      preactRender(null, this.container);
      this.container = null;
    }
  }

  /** Atualiza a lista de recursos usada pela validação DURA de ocupação. */
  setResources(resources: readonly CalendarResource[]): void {
    this.resources = resources;
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
    if (this.draft) context.draft = this.draft;
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

  // ---- interação (Fase 4) ----------------------------------------------------

  /** Constrói o InteractionEngine ligado a este app (dados vivos + política de avaliação). */
  private createInteractionEngine(): InteractionEngine {
    return new InteractionEngine({
      getGridBounds: () => {
        const { options } = this.store.getState();
        return { startMin: options.startHour * 60, endMin: options.endHour * 60 };
      },
      getSlotMinutes: () => this.store.getState().options.slotMinutes,
      getMinDurationMin: () => this.store.getState().options.minEventMinutes,
      evaluate: (input) => this.evaluateDraft(input),
      resolveOccurrence: (eventId) => this.occurrenceIndex.get(eventId) ?? null,
      callbacks: {
        onDraftChange: (draft) => {
          this.draft = draft;
          this.renderNow();
        },
        commitMove: (change) => this.applyEventChange(change, this.onEventDrop),
        commitResize: (change) => this.applyEventChange(change, this.onEventResize),
        commitSelect: (selection) => this.onDateSelect?.(selection),
        clickEvent: (placement) => this.onEventClick?.(placement.occurrence),
        clickEmpty: (slot: PointerSlot) =>
          this.onDateClick?.(slot.dateISO, Math.round(slot.minuteOfDay)),
        blocked: (info: BlockedInfo) => {
          const isSelection = info.kind === 'select';
          if (isSelection) this.onClickBlocked?.(info);
          else this.onDropBlocked?.(info);
        },
      },
    });
  }

  /** Avalia um candidato: ConstraintEngine (business/blocked/allowed) + ocupação de recurso. */
  private evaluateDraft(input: EvaluationInput): DraftEvaluation {
    const slot: Slot = { date: input.dateISO, startMin: input.startMin, endMin: input.endMin };
    const baseEvaluation = this.engine.evaluate(slot);
    if (!baseEvaluation.valid) {
      const reason = (baseEvaluation.reason ?? 'blocked') as DraftReason;
      return { valid: false, reason };
    }
    const occurrence = input.occurrence;
    const canCheckOccupancy = occurrence !== undefined && this.temporal !== null;
    if (canCheckOccupancy) {
      const resourceIds = occurrence!.event.resourceIds ?? [];
      for (const resourceId of resourceIds) {
        const resource = this.resources.find((candidate) => candidate.id === resourceId);
        if (!resource) continue;
        const occupancyResult = this.evaluateResourceOccupancy(resource.id, input);
        if (!occupancyResult.valid) return occupancyResult;
      }
    }
    return { valid: true, reason: 'ok' };
  }

  /** Ocupação de UM recurso: concorrência (lotação) + buffers na nova posição do candidato. */
  private evaluateResourceOccupancy(resourceId: string, input: EvaluationInput): DraftEvaluation {
    const temporal = this.temporal!;
    const resource = this.resources.find((candidate) => candidate.id === resourceId)!;
    const movedId = input.occurrence ? occurrenceKey(input.occurrence) : '';
    const dayPlain = temporal.PlainDate.from(input.dateISO);
    const resourceOccurrences = occurrencesForResource(this.currentOccurrences, resourceId).filter(
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
    const occupancy: ResourceOccupancy = {
      capacity: resource.capacity ?? 1,
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
    const previousEvents = this.store.getState().events;
    const nextEvents = applyEventTimeChange(previousEvents, change);
    this.setEvents(nextEvents);
    if (!callback) return;
    const result = callback(change);
    void Promise.resolve(result)
      .then((outcome) => {
        const rejected = outcome === false;
        if (rejected) this.setEvents(previousEvents);
      })
      .catch(() => this.setEvents(previousEvents));
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
