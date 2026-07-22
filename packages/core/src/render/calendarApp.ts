/**
 * CalendarApp — orquestrador headless (ADR-001/002).
 *
 * Responsabilidade: manter o store (fonte de verdade), resolver o Temporal, expor uma API
 * imperativa (prev/next/today/changeView/setEvents/setConstraints/…) e renderizar a si mesmo
 * com Preact num container isolado. Navegar/trocar view = `setState` → o Preact faz o diff no
 * MESMO container; a instância NUNCA é recriada (mata o rerender parasita do host).
 *
 * Pipeline por render: expandir recorrência (memoizada) → projetar em minutos-do-dia →
 * geometria (waterfall) → camada de fundo (horário comercial/bloqueios via ConstraintSet) →
 * GridVM → TimeGrid.
 */
import { render as preactRender, h as createElement } from 'preact';

import { createStore, type Store } from '../store/store.js';
import { memoize } from '../store/memoize.js';
import { ensureTemporal, type TemporalLike } from '../date/temporal.js';
import { createDateUtils, type DateUtils } from '../date/dateUtils.js';
import { ConstraintEngine, type Slot } from '../constraint/constraintEngine.js';
import type { CalendarEvent, EventOccurrence } from '../types/event.js';
import type { ConstraintSet, SlotEvaluation } from '../types/constraint.js';

import { expandRange, buildDays } from './derive.js';
import {
  DEFAULT_OPTIONS,
  type CalendarOptions,
  type CalendarState,
} from './state.js';

import { layoutDay, type GeoGrid } from '../geometry/geometry.js';
import { BUILTIN_VIEWS, weekView } from '../views/timeGridViews.js';
import type { TimeGridViewDef, ViewContext, ViewRange } from '../views/viewDef.js';
import { TimeGrid } from '../views/TimeGrid.js';
import { formatDate, formatHourLabel } from '../views/format.js';
import type { GridVM, DayColumnVM, EventVM } from '../views/viewModel.js';

type PlainDate = InstanceType<TemporalLike['PlainDate']>;

export type CalendarEventName = 'render' | 'dateChange' | 'viewChange' | 'rangeChange';

export interface RangeChange {
  start: string;
  end: string;
}

export interface CalendarConfig {
  date?: string;
  view?: string;
  events?: CalendarEvent[];
  constraints?: ConstraintSet;
  options?: Partial<CalendarOptions>;
  /** Views extras (além de week/day). Registrar view nova é 1ª classe. */
  views?: TimeGridViewDef[];
  /** Injeta Temporal já resolvido (testes/SSR). Ausente → carrega via ensureTemporal(). */
  temporal?: TemporalLike;
}

function padTwo(value: number): string {
  return value < 10 ? `0${value}` : `${value}`;
}

export class CalendarApp {
  private readonly store: Store<CalendarState>;
  private readonly views = new Map<string, TimeGridViewDef>();
  private readonly engine: ConstraintEngine;
  private readonly listeners = new Map<CalendarEventName, Set<(payload: unknown) => void>>();
  private readonly readyPromise: Promise<void>;
  private readonly memoExpand = memoize(expandRange);

  private container: HTMLElement | null = null;
  private unsubscribe: (() => void) | null = null;
  private temporal: TemporalLike | null = null;
  private dateUtils: DateUtils | null = null;

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

    if (config.temporal) {
      this.temporal = config.temporal;
      this.dateUtils = createDateUtils(config.temporal);
      this.readyPromise = Promise.resolve();
    } else {
      this.readyPromise = ensureTemporal().then((resolvedTemporal) => {
        this.temporal = resolvedTemporal;
        this.dateUtils = createDateUtils(resolvedTemporal);
      });
    }
  }

  // ---- ciclo de vida ---------------------------------------------------------

  /** Monta o calendário no container. Renderiza assim que o Temporal estiver pronto. */
  mount(container: HTMLElement): void {
    this.container = container;
    if (!this.unsubscribe) {
      this.unsubscribe = this.store.subscribe(() => this.renderNow());
    }
    void this.readyPromise.then(() => this.renderNow());
  }

  /** Resolve quando o Temporal está pronto e um primeiro render (se montado) ocorreu. */
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
  }

  changeView(viewName: string): void {
    if (!this.views.has(viewName)) {
      throw new Error(`[meucalendario] view não registrada: ${viewName}`);
    }
    this.store.setState({ viewName });
    this.emit('viewChange', viewName);
    this.emitRange();
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

  /** Registra/subscreve view nova (1ª classe). */
  registerView(definition: TimeGridViewDef): void {
    this.views.set(definition.name, definition);
  }

  /** Título da view/data atuais. */
  getTitle(): string {
    const { view, range, context } = this.resolveView();
    return view.getTitle(range, context);
  }

  /** Range visível (datas ISO inclusivas) — dispara eventSource.fetch nas fases seguintes. */
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

  /** Constrói o view model atual sem desenhar (útil para teste/headless puro). */
  buildViewModel(): GridVM {
    return this.buildVM();
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
    view: TimeGridViewDef;
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

  private renderNow(): void {
    if (!this.temporal || !this.dateUtils || !this.container) return;
    const viewModel = this.buildVM();
    preactRender(createElement(TimeGrid, { vm: viewModel }), this.container);
    this.emit('render', viewModel);
  }

  private buildVM(): GridVM {
    const temporal = this.temporal!;
    const state = this.store.getState();
    const { options } = state;
    const { view, range, context } = this.resolveView();

    const startISO = range.startDate.toString();
    const endISO = range.endDate.toString();

    // Expansão de recorrência memoizada por (temporal, events, start, end): trocar constraints
    // NÃO recomputa ocorrências; navegar (range muda) recomputa só o necessário.
    const occurrences: EventOccurrence[] = this.memoExpand(temporal, state.events, startISO, endISO);

    const days = buildDays(
      temporal,
      range.days,
      occurrences,
      state.constraints,
      { startHour: options.startHour, endHour: options.endHour },
      options.timeZone,
    );

    // Relógio da linha "agora" (injetável para teste).
    const nowMilliseconds = options.nowMs ?? Date.now();
    const nowZoned = temporal.Instant.fromEpochMilliseconds(nowMilliseconds).toZonedDateTimeISO(
      options.timeZone,
    );
    const nowDayISO = nowZoned.toPlainDate().toString();
    const nowMinuteOfDay = nowZoned.hour * 60 + nowZoned.minute;
    const gridTopMin = options.startHour * 60;
    const gridBottomMin = options.endHour * 60;

    const geometryGrid: GeoGrid = {
      startHour: options.startHour,
      endHour: options.endHour,
      pxPerMinute: options.pxPerMinute,
      minEventMinutes: 15,
      gutter: 0,
    };

    const columns: DayColumnVM[] = days.map((day) => {
      const placementById = new Map(day.timed.map((placement) => [placement.id, placement]));
      const blocks = layoutDay(day.timed, geometryGrid);
      const events: EventVM[] = blocks.map((block) => {
        const placement = placementById.get(block.id)!;
        const event = placement.occurrence.event;
        const eventVM: EventVM = {
          id: block.id,
          block,
          title: event.title,
          timeLabel: formatHourLabel(placement.startMin, options.locale),
        };
        if (event.color !== undefined) eventVM.color = event.color;
        return eventVM;
      });

      const isToday = day.dateISO === nowDayISO;
      return {
        dateISO: day.dateISO,
        weekdayLabel: formatDate(day.date, options.locale, { weekday: 'short' }),
        dayLabel: formatDate(day.date, options.locale, { day: 'numeric' }),
        isToday,
        nonBusiness: day.nonBusiness,
        blocked: day.blocked,
        allDay: day.allDay.map((occurrence) => {
          const event = occurrence.event;
          const key = `${occurrence.masterId}@${occurrence.originalStart}`;
          return event.color !== undefined
            ? { id: key, title: event.title, color: event.color }
            : { id: key, title: event.title };
        }),
        events,
        nowMinutes:
          isToday && nowMinuteOfDay >= gridTopMin && nowMinuteOfDay <= gridBottomMin
            ? nowMinuteOfDay
            : null,
      };
    });

    const hourLabels: GridVM['hourLabels'] = [];
    for (let minute = gridTopMin; minute <= gridBottomMin; minute += options.slotMinutes) {
      hourLabels.push({ min: minute, label: formatHourLabel(minute, options.locale) });
    }

    return {
      title: view.getTitle(range, context),
      viewName: state.viewName,
      locale: options.locale,
      startHour: options.startHour,
      endHour: options.endHour,
      pxPerMinute: options.pxPerMinute,
      slotMinutes: options.slotMinutes,
      hourLabels,
      columns,
    };
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
