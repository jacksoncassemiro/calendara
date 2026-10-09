/**
 * Public declarative and imperative contracts for the native React calendar.
 * @remarks Português: CalendarProps configura o componente; CalendarHandle oferece ações
 * por apiRef/useCalendar, mantendo a persistência dos eventos na aplicação consumidora.
 */
import type { CSSProperties, RefObject, ReactNode } from 'react';
import type { ExternalEventDropHandler, EventDropOutsideInfo } from './externalDrag.js';
import type { CalendarPrintOptions } from './printing.js';
import type {
  CalendarEvent,
  EventOccurrence,
  ConstraintSet,
  CalendarResource,
  CalendarOptions,
  CalendarState,
  EventChange,
  SelectionChange,
  BlockedInfo,
  CommitResult,
  Slot,
  SlotEvaluation,
  TemporalLike,
  EvaluationInput,
  DraftEvaluation,
} from '../core/index.js';

/** Stable imperative calendar API.
 * @remarks Português: Ações e consultas da instância obtida por apiRef/useCalendar.
 */
export interface CalendarHandle {
  /** Navigate to the previous range of the active view.
   * @remarks Português: Navega para o período anterior conforme a view ativa.
   */
  prev(): void;
  /** Navigate to the next range of the active view.
   * @remarks Português: Navega para o próximo período conforme a view ativa.
   */
  next(): void;
  /** Navigate to today in the configured time zone.
   * @remarks Português: Navega para hoje no fuso horário configurado.
   */
  today(): void;
  /** Navigate to an ISO reference date.
   * @remarks Português: Navega para a data de referência em YYYY-MM-DD, sem alterar as props do
   * consumidor.
   */
  setDate(dateISO: string): void;
  /** Activate a registered view.
   * @remarks Português: Ativa uma view registrada em views; nomes não registrados são rejeitados.
   */
  changeView(viewName: string): void;
  /** Read the active view title.
   * @remarks Português: Retorna o título calculado pela view e pelo período atuais.
   */
  getTitle(): string;
  /** Read the visible range with inclusive ISO endpoints.
   * @remarks Português: Retorna o primeiro e o último dia visíveis, ambos inclusivos.
   */
  getVisibleRange(): RangeChange;
  /** Print loaded events in the visible range; PDF uses the browser dialog.
   * @remarks Português: Imprime eventos carregados do período; PDF pelo diálogo do navegador.
   */
  print(options?: CalendarPrintOptions): boolean;
  /** Read the current calendar state.
   * @remarks Português: Retorna o estado atual para consulta; trate os dados como imutáveis.
   */
  getState(): Readonly<CalendarState>;
  /** List the configured view names and labels.
   * @remarks Português: Lista somente as views registradas nesta instância.
   */
  listViews(): {
    /** Registered view identifier. @remarks Português: Identificador da view registrada. */
    name: string;
    /** Display text. @remarks Português: Texto exibido. */
    label: string;
  }[];
  /** Check global constraints for a slot.
   * @remarks Português: Verifica regras gerais; capacidade e buffers usam
   * evaluatePlacement/evaluateEvent.
   */
  evaluateSlot(slot: Slot): SlotEvaluation;
  /** Validate placement constraints, capacity and buffers.
   * @remarks Português: Valida intervalo e recursos; ao editar, informe occurrence para excluir sua
   * ocupação.
   */
  evaluatePlacement(input: Omit<EvaluationInput, 'kind'>): DraftEvaluation;
  /** Validate one editor candidate without persisting it.
   * @remarks Português: Valida a janela e os recursos, não toda a série futura. Informe a ocorrência
   * original ao editar; lança erro antes de estar pronto.
   */
  evaluateEvent(event: CalendarEvent, occurrence?: EventOccurrence): DraftEvaluation;
  /** Request events again for the current visible range.
   * @remarks Português: Busca novamente os eventos do período atual quando eventSource está
   * definido.
   */
  refetch(): void;
}

/** Configure the native React calendar and its consumer callbacks.
 * @remarks Português: Configura dados, views, renderização e callbacks; a aplicação decide
 * como editar e persistir eventos.
 */
export interface CalendarProps {
  /** Initial reference date in YYYY-MM-DD format.
   * @remarks Português: Usada só na montagem; date tem precedência.
   */
  initialDate?: string;
  /** Initial registered view; omitted selects the first configured view.
   * @remarks Português: Usada só na montagem; view tem precedência. Ausente usa a primeira view.
   */
  initialView?: string;
  /** Navigate when this prop changes; it is not strictly controlled state.
   * @remarks Português: Mudar a prop navega; toolbar/API podem navegar até a próxima mudança da
   * prop.
   */
  date?: string;
  /** Switch views when this prop changes; it is not strictly controlled state.
   * @remarks Português: Mudar a prop troca a view; toolbar/API podem trocar até a próxima mudança da
   * prop.
   */
  view?: string;
  /** Current immutable event collection.
   * @remarks Português: Mudar a coleção atualiza os eventos; a aplicação persiste as alterações.
   */
  events?: readonly CalendarEvent[];
  /** Global availability and blocked intervals.
   * @remarks Português: Disponibilidade e bloqueios gerais, obrigatórios também nos recursos.
   */
  constraints?: ConstraintSet;
  /** Override calendar behavior and layout defaults.
   * @remarks Português: Substitui opções padrão de comportamento, fuso, horários e geometria.
   */
  options?: Partial<CalendarOptions>;
  /** Resource availability, capacity and preparation buffers.
   * @remarks Português: Recursos validados na criação, movimento e edição.
   */
  resources?: readonly CalendarResource[];
  /** Complete, nonempty available view list; pass BUILTIN_VIEWS to select the standard set.
   * @remarks Português: Lista explícita, não vazia; a primeira é inicial se initialView/view não for
   * informado.
   */
  views: readonly CalendarView[];
  /** Inject Temporal for SSR or tests.
   * @remarks Português: Ausente carrega por ensureTemporal().
   */
  temporal?: TemporalLike;
  /** Load events for the visible range.
   * @remarks Português: Fonte de eventos por período; use context.signal para cancelar buscas
   * obsoletas.
   */
  eventSource?: EventSource;
  /** Reload the current range when this value changes.
   * @remarks Português: Mudar o valor busca novamente, sem navegar.
   */
  refetchKey?: string | number;
  /** Custom React content inside an event card.
   * @remarks Português: Personaliza o conteúdo, preservando a geometria e os gestos do cartão.
   */
  renderEvent?: (info: EventSlotInfo) => ReactNode;
  /** Custom month-overflow content.
   * @remarks Português: Conteúdo de ver mais no mês; o contexto permite fechar ou abrir outra view.
   */
  renderMonthMore?: MonthMoreRenderSlot;
  /** Custom timed-event overflow content.
   * @remarks Português: Conteúdo de ver mais na grade de horário; permite fechar ou abrir outra
   * view.
   */
  renderEventMore?: MonthMoreRenderSlot;
  /** Custom date styling without availability changes.
   * @remarks Português: Estiliza o dia; para bloquear horários, use constraints.
   */
  getDayStyle?: DayStyleCallback;
  /** Custom date/resource headings; wrap defaultContent to preserve navigation.
   * @remarks Português: Personaliza títulos; envolva defaultContent para preservar navegação.
   */
  renderDayHeader?: DayHeaderRenderSlot;
  /** Handle month overflow; false replaces the built-in opening.
   * @remarks Português: Recebe data/ocorrências; false substitui a abertura padrão.
   */
  onMonthMoreClick?: (info: MonthMoreInfo) => void | false;
  /** Handle timed overflow; false replaces the built-in opening.
   * @remarks Português: Recebe as ocorrências; false substitui a abertura padrão.
   */
  onEventMoreClick?: (info: MonthMoreInfo) => void | false;
  /** Replace the built-in toolbar.
   * @remarks Português: Substitui a toolbar; recebe título, views e navegação.
   */
  customToolbar?: (context: ToolbarContext) => ReactNode;
  /** Activate an occurrence in the consumer flow.
   * @remarks Português: Recebe a ocorrência; não abre editor automaticamente.
   */
  onEventClick?: (occurrence: EventOccurrence) => void;
  /** Observe reference-date changes, including initial state.
   * @remarks Português: Notifica a data inicial e mudanças pela toolbar, API ou props.
   */
  onDateChange?: (dateISO: string) => void;
  /** Observe active-view changes, including initial state.
   * @remarks Português: Notifica a view inicial e mudanças pela toolbar, API ou props.
   */
  onViewChange?: (viewName: string) => void;
  /** Observe changes to the inclusive visible date range.
   * @remarks Português: Notifica o período visível com primeiro e último dia inclusivos.
   */
  onRangeChange?: (range: RangeChange) => void;
  /** Receive asynchronous calendar failures.
   * @remarks Português: Recebe falhas assíncronas para tratamento pela aplicação.
   */
  onError?: (error: unknown) => void;
  /** Observe the current event-source request.
   * @remarks Português: Indica se a busca atual está pendente; não contabiliza pedidos obsoletos.
   */
  onLoadingChange?: (loading: boolean) => void;
  /** Activate an available date or minute-of-day slot.
   * @remarks Português: Recebe data e minuto quando aplicável; inválidos seguem para onClickBlocked.
   */
  onDateClick?: (dateISO: string, minuteOfDay?: number) => void;
  /** Persist an optimistic move, or reject it.
   * @remarks Português: A aplicação salva; false ou Promise rejeitada reverte a movimentação
   * otimista.
   */
  onEventDrop?: (change: EventChange) => CommitResult;
  /** Receive a candidate for consumer insertion and persistence.
   * @remarks Português: Habilita entrada; change.event tem horário/recursos propostos. A aplicação
   * insere e salva, sem remoção automática da origem.
   */
  onExternalEventDrop?: ExternalEventDropHandler;
  /** Export an occurrence without deleting it automatically.
   * @remarks Português: Habilita saída; a aplicação escolhe o destino e decide copiar, mover ou
   * remover.
   */
  onEventDropOutside?: (info: EventDropOutsideInfo) => void | Promise<void>;
  /** Persist an optimistic resize, or reject it.
   * @remarks Português: A aplicação salva; false ou Promise rejeitada reverte o redimensionamento
   * otimista.
   */
  onEventResize?: (change: EventChange) => CommitResult;
  /** Handle a validated interval without inserting an event.
   * @remarks Português: Recebe o intervalo para criação pela aplicação; não insere evento
   * automaticamente.
   */
  onDateSelect?: (selection: SelectionChange) => void;
  /** Observe a rejected move or resize.
   * @remarks Português: Recebe o candidato e o motivo: regras, capacidade ou buffers.
   */
  onDropBlocked?: (info: BlockedInfo) => void;
  /** Observe a rejected date click or interval selection.
   * @remarks Português: Recebe o motivo da recusa antes de iniciar a criação no fluxo da aplicação.
   */
  onClickBlocked?: (info: BlockedInfo) => void;
  /** Receive the imperative calendar API.
   * @remarks Português: Recebe CalendarHandle; use useCalendar para criar a ref.
   */
  apiRef?: RefObject<CalendarHandle | null>;
  /** Add a class to the calendar root.
   * @remarks Português: Acrescenta uma classe ao elemento raiz para integração visual.
   */
  className?: string;
  /** Inline styles for the calendar root.
   * @remarks Português: Estiliza a raiz; a geometria dos slots continua nas options.
   */
  style?: CSSProperties;
}

import type {
  CalendarView,
  ToolbarContext,
  EventSlotInfo,
  MonthMoreInfo,
  MonthMoreRenderSlot,
  DayStyleCallback,
  DayHeaderRenderSlot,
} from './viewTypes.js';
import type { RangeChange, EventSource } from './app/calendarApp.js';
