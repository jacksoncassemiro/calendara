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
import { render as preactRender, h } from 'preact';

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

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export class CalendarApp {
  private readonly store: Store<CalendarState>;
  private readonly views = new Map<string, TimeGridViewDef>();
  private readonly engine: ConstraintEngine;
  private readonly listeners = new Map<CalendarEventName, Set<(payload: unknown) => void>>();
  private readonly readyPromise: Promise<void>;
  private readonly memoExpand = memoize(expandRange);

  private container: HTMLElement | null = null;
  private unsub: (() => void) | null = null;
  private T: TemporalLike | null = null;
  private dateUtils: DateUtils | null = null;

  constructor(config: CalendarConfig = {}) {
    const options: CalendarOptions = { ...DEFAULT_OPTIONS, ...config.options };
    const initial: CalendarState = {
      date: config.date ?? this.localTodayISO(),
      viewName: config.view ?? 'week',
      events: config.events ?? [],
      constraints: config.constraints ?? {},
      options,
    };
    this.store = createStore(initial);
    for (const v of BUILTIN_VIEWS) this.views.set(v.name, v);
    for (const v of config.views ?? []) this.views.set(v.name, v);
    this.engine = new ConstraintEngine(initial.constraints);

    if (config.temporal) {
      this.T = config.temporal;
      this.dateUtils = createDateUtils(config.temporal);
      this.readyPromise = Promise.resolve();
    } else {
      this.readyPromise = ensureTemporal().then((t) => {
        this.T = t;
        this.dateUtils = createDateUtils(t);
      });
    }
  }

  // ---- ciclo de vida ---------------------------------------------------------

  /** Monta o calendário no container. Renderiza assim que o Temporal estiver pronto. */
  mount(container: HTMLElement): void {
    this.container = container;
    if (!this.unsub) {
      this.unsub = this.store.subscribe(() => this.renderNow());
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
    if (this.unsub) {
      this.unsub();
      this.unsub = null;
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

  setDate(iso: string): void {
    this.store.setState({ date: iso });
    this.emit('dateChange', iso);
    this.emitRange();
  }

  changeView(name: string): void {
    if (!this.views.has(name)) {
      throw new Error(`[meucalendario] view não registrada: ${name}`);
    }
    this.store.setState({ viewName: name });
    this.emit('viewChange', name);
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
  registerView(def: TimeGridViewDef): void {
    this.views.set(def.name, def);
  }

  /** Título da view/data atuais. */
  getTitle(): string {
    const { view, range, ctx } = this.resolveView();
    return view.getTitle(range, ctx);
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

  on(event: CalendarEventName, cb: (payload: unknown) => void): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(cb);
    return () => set!.delete(cb);
  }

  /** Constrói o view model atual sem desenhar (útil para teste/headless puro). */
  buildViewModel(): GridVM {
    return this.buildVM();
  }

  // ---- interno ---------------------------------------------------------------

  private navigate(dir: 'prev' | 'next'): void {
    if (!this.T || !this.dateUtils) return;
    const { view, ctx } = this.resolveView();
    const date = this.T.PlainDate.from(this.store.getState().date);
    const nd = view.navigate(dir, date, ctx);
    this.setDate(nd.toString());
  }

  private resolveView(): { view: TimeGridViewDef; range: ViewRange; ctx: ViewContext; date: PlainDate } {
    const T = this.T!;
    const state = this.store.getState();
    const view = this.views.get(state.viewName) ?? weekView;
    const ctx: ViewContext = { T, dateUtils: this.dateUtils!, options: state.options };
    const date = T.PlainDate.from(state.date);
    const range = view.getRange(date, ctx);
    return { view, range, ctx, date };
  }

  private renderNow(): void {
    if (!this.T || !this.dateUtils || !this.container) return;
    const vm = this.buildVM();
    preactRender(h(TimeGrid, { vm }), this.container);
    this.emit('render', vm);
  }

  private buildVM(): GridVM {
    const T = this.T!;
    const state = this.store.getState();
    const { options } = state;
    const { view, range, ctx } = this.resolveView();

    const startISO = range.startDate.toString();
    const endISO = range.endDate.toString();

    // Expansão de recorrência memoizada por (T, events, start, end): trocar constraints
    // NÃO recomputa ocorrências; navegar (range muda) recomputa só o necessário.
    const occurrences: EventOccurrence[] = this.memoExpand(T, state.events, startISO, endISO);

    const days = buildDays(
      T,
      range.days,
      occurrences,
      state.constraints,
      { startHour: options.startHour, endHour: options.endHour },
      options.timeZone,
    );

    // Relógio da linha "agora" (injetável para teste).
    const nowMs = options.nowMs ?? Date.now();
    const nowZdt = T.Instant.fromEpochMilliseconds(nowMs).toZonedDateTimeISO(options.timeZone);
    const nowDayISO = nowZdt.toPlainDate().toString();
    const nowMinutes = nowZdt.hour * 60 + nowZdt.minute;
    const gridTop = options.startHour * 60;
    const gridBot = options.endHour * 60;

    const geoGrid: GeoGrid = {
      startHour: options.startHour,
      endHour: options.endHour,
      pxPerMinute: options.pxPerMinute,
      minEventMinutes: 15,
      gutter: 0,
    };

    const columns: DayColumnVM[] = days.map((day) => {
      const placementById = new Map(day.timed.map((p) => [p.id, p]));
      const blocks = layoutDay(day.timed, geoGrid);
      const events: EventVM[] = blocks.map((block) => {
        const p = placementById.get(block.id)!;
        const ev = p.occurrence.event;
        const evVM: EventVM = {
          id: block.id,
          block,
          title: ev.title,
          timeLabel: formatHourLabel(p.startMin, options.locale),
        };
        if (ev.color !== undefined) evVM.color = ev.color;
        return evVM;
      });

      const isToday = day.dateISO === nowDayISO;
      return {
        dateISO: day.dateISO,
        weekdayLabel: formatDate(day.date, options.locale, { weekday: 'short' }),
        dayLabel: formatDate(day.date, options.locale, { day: 'numeric' }),
        isToday,
        nonBusiness: day.nonBusiness,
        blocked: day.blocked,
        allDay: day.allDay.map((occ) => {
          const ev = occ.event;
          return ev.color !== undefined
            ? { id: `${occ.masterId}@${occ.originalStart}`, title: ev.title, color: ev.color }
            : { id: `${occ.masterId}@${occ.originalStart}`, title: ev.title };
        }),
        events,
        nowMinutes: isToday && nowMinutes >= gridTop && nowMinutes <= gridBot ? nowMinutes : null,
      };
    });

    const hourLabels: GridVM['hourLabels'] = [];
    for (let min = gridTop; min <= gridBot; min += options.slotMinutes) {
      hourLabels.push({ min, label: formatHourLabel(min, options.locale) });
    }

    return {
      title: view.getTitle(range, ctx),
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

  private emit(event: CalendarEventName, payload: unknown): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const cb of [...set]) cb(payload);
  }

  private emitRange(): void {
    if (!this.T) return;
    this.emit('rangeChange', this.getVisibleRange());
  }

  private todayISO(): string {
    if (this.T) {
      return this.T.Now.zonedDateTimeISO(this.store.getState().options.timeZone)
        .toPlainDate()
        .toString();
    }
    return this.localTodayISO();
  }

  private localTodayISO(): string {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
}
