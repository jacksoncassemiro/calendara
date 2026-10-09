/** Custom view, content-slot and toolbar contracts.
 * @remarks Português: Contratos de views, slots de conteúdo e toolbar personalizados.
 */
import type { ReactNode, CSSProperties } from 'react';
import type { TemporalLike } from '../core/index.js';
import type { DateUtils } from '../core/index.js';
import type { CalendarOptions } from '../core/index.js';
import type { CalendarEvent, EventOccurrence } from '../core/index.js';
import type { ConstraintSet } from '../core/index.js';
import type { InteractionDraft } from '../core/index.js';
import type { CalendarResource } from '../core/index.js';

type PlainDate = InstanceType<TemporalLike['PlainDate']>;

/** Date logic and resolved options for a view.
 * @remarks Português: Cálculos de data e opções resolvidas da view.
 */
export interface ViewContext {
  /** Resolved Temporal implementation.
   * @remarks Português: Implementação Temporal resolvida.
   */
  temporal: TemporalLike;
  /** Calendar date calculations for this view.
   * @remarks Português: Cálculos de datas do calendário para esta view.
   */
  dateUtils: DateUtils;
  /** Resolved calendar options.
   * @remarks Português: Opções resolvidas do calendário.
   */
  options: CalendarOptions;
}

/** Visible dates with inclusive range bounds.
 * @remarks Português: Datas visíveis com limites inclusivos.
 */
export interface ViewRange {
  /** Visible dates in display order.
   * @remarks Português: Datas visíveis na ordem de exibição.
   */
  days: PlainDate[];
  /** Inclusive first date of the range.
   * @remarks Português: Primeira data inclusiva do período.
   */
  startDate: PlainDate;
  /** Inclusive last date of the range.
   * @remarks Português: Última data inclusiva do período.
   */
  endDate: PlainDate;
}

/** Event-card content context.
 * @remarks Português: Contexto do conteúdo de um cartão de evento.
 */
export interface EventSlotInfo {
  /** Rendered occurrence with its original identity.
   * @remarks Português: Ocorrência renderizada com a identidade original.
   */
  occurrence: EventOccurrence;
  /** Effective event of the rendered occurrence.
   * @remarks Português: Evento efetivo da ocorrência renderizada.
   */
  event: CalendarEvent;
  /** Formatted time label; empty for all-day events.
   * @remarks Português: Rótulo de horário formatado; vazio em dia inteiro.
   */
  timeLabel: string;
  /** Whether this content belongs to an all-day event.
   * @remarks Português: Indica conteúdo de evento de dia inteiro.
   */
  isAllDay: boolean;
}

/** Render custom React content inside an event card.
 * @remarks Português: Renderiza conteúdo React dentro do cartão de evento.
 */
export type EventRenderSlot = (info: EventSlotInfo) => ReactNode;

/** Overflow occurrences and navigation actions.
 * @remarks Português: Ocorrências de ver mais e ações de navegação.
 */
export interface MonthMoreInfo {
  /** Overflow date in YYYY-MM-DD format.
   * @remarks Português: Data de ver mais em YYYY-MM-DD.
   */
  dateISO: string;
  /** Occurrences supplied by this overflow group.
   * @remarks Português: Ocorrências fornecidas por este grupo de ver mais.
   */
  occurrences: readonly EventOccurrence[];
  /** Occurrences hidden by the current layout limit.
   * @remarks Português: Ocorrências ocultas pelo limite de layout atual.
   */
  hiddenOccurrences: readonly EventOccurrence[];
  /** Element anchoring the overflow popover.
   * @remarks Português: Elemento que ancora o popover de ver mais.
   */
  anchor: HTMLElement;
  /** Close the current overflow popover.
   * @remarks Português: Fecha o popover atual de ver mais.
   */
  close(): void;
  /** Open a registered view at this overflow date.
   * @remarks Português: Abre uma view registrada nesta data.
   */
  openView(viewName: string): void;
}
/** Timed-overflow alias of the shared overflow context.
 * @remarks Português: Contexto compartilhado para ver mais nas grades de horário.
 */
export type EventMoreInfo = MonthMoreInfo;
/** Timed-overflow alias of the shared content slot.
 * @remarks Português: Slot compartilhado do conteúdo de ver mais na grade de horário.
 */
export type EventMoreRenderSlot = MonthMoreRenderSlot;
/** Render custom overflow-popover content.
 * @remarks Português: Renderiza conteúdo personalizado do popover de ver mais.
 */
export type MonthMoreRenderSlot = (info: MonthMoreInfo) => ReactNode;

/** Date and optional resource being styled.
 * @remarks Português: Data e recurso opcional que recebem o estilo.
 */
export interface DayStyleInfo {
  /** Styled date in YYYY-MM-DD format.
   * @remarks Português: Data estilizada em YYYY-MM-DD.
   */
  dateISO: string;
  /** Name of the view requesting the style.
   * @remarks Português: Nome da view que solicita o estilo.
   */
  viewName: string;
  /** Resource ID when styling a resource surface.
   * @remarks Português: ID do recurso ao estilizar uma superfície de recurso.
   */
  resourceId?: string;
}
/** Style a date without changing availability.
 * @remarks Português: Estiliza uma data sem alterar disponibilidade.
 */
export type DayStyleCallback = (info: DayStyleInfo) => CSSProperties | undefined;
/** Date header content and state.
 * @remarks Português: Conteúdo e estado do cabeçalho da data.
 */
export interface DayHeaderInfo extends DayStyleInfo {
  /** Built-in content to preserve or wrap.
   * @remarks Português: Conteúdo padrão para preservar ou envolver.
   */
  defaultContent: ReactNode;
  /** Date is today in the calendar time zone.
   * @remarks Português: Data é hoje no fuso do calendário.
   */
  isToday: boolean;
  /** Selected date in compact month mode.
   * @remarks Português: Data selecionada no mês compacto.
   */
  isSelected?: boolean;
}
/** Customize date/resource headings.
 * @remarks Português: Personaliza títulos de datas/recursos.
 */
export type DayHeaderRenderSlot = (info: DayHeaderInfo) => ReactNode;
/** Resolved data and callbacks for the view body.
 * @remarks Português: Dados e callbacks resolvidos para o corpo da view.
 */
export interface ViewRenderContext {
  /** Calendar reference date in YYYY-MM-DD format.
   * @remarks Português: Data de referência do calendário em YYYY-MM-DD.
   */
  referenceDateISO?: string;
  /** Active registered view name when supplied by the calendar.
   * @remarks Português: Nome da view ativa quando fornecido pelo calendário.
   */
  viewName?: string;
  /** Date styling without changing availability.
   * @remarks Português: Estilo de datas sem alterar disponibilidade.
   */
  getDayStyle?: DayStyleCallback;
  /** Custom date/resource header content.
   * @remarks Português: Conteúdo dos títulos de datas/recursos.
   */
  renderDayHeader?: DayHeaderRenderSlot;
  /** Live resources; omitted preserves view-factory resources.
   * @remarks Português: Recursos atuais; ausente preserva os recursos da factory da view.
   */
  resources?: readonly CalendarResource[];
  /** Resolved Temporal implementation.
   * @remarks Português: Implementação Temporal resolvida.
   */
  temporal: TemporalLike;
  /** Calendar date calculations for this view.
   * @remarks Português: Cálculos de datas do calendário para esta view.
   */
  dateUtils: DateUtils;
  /** Resolved calendar options.
   * @remarks Português: Opções resolvidas do calendário.
   */
  options: CalendarOptions;
  /** Visible dates and inclusive endpoints.
   * @remarks Português: Datas visíveis e extremos inclusivos.
   */
  range: ViewRange;
  /** Expanded occurrences intersecting the visible range.
   * @remarks Português: Ocorrências expandidas que cruzam o período visível.
   */
  occurrences: EventOccurrence[];
  /** Adjacent occurrences for buffer shading, not visible event cards.
   * @remarks Português: Ocorrências adjacentes para buffers, sem cartões visíveis.
   */
  resourceBufferOccurrences?: readonly EventOccurrence[];
  /** Current global availability rules.
   * @remarks Português: Regras gerais atuais de disponibilidade.
   */
  constraints: ConstraintSet;
  /** Resolved current time in epoch milliseconds.
   * @remarks Português: Horário atual resolvido em milissegundos desde epoch.
   */
  nowMs: number;
  /** Live move, resize or selection preview.
   * @remarks Português: Prévia atual de movimento, redimensionamento ou seleção.
   */
  draft?: InteractionDraft;
  /** Custom React event-card content.
   * @remarks Português: Conteúdo React personalizado do cartão de evento.
   */
  renderEvent?: EventRenderSlot;
  /** Custom month-overflow content.
   * @remarks Português: Conteúdo personalizado de ver mais no mês.
   */
  renderMonthMore?: MonthMoreRenderSlot;
  /** Custom timed-event overflow content.
   * @remarks Português: Conteúdo personalizado de ver mais na grade de horário.
   */
  renderEventMore?: MonthMoreRenderSlot;
  /** Handle month overflow; false suppresses the built-in opening.
   * @remarks Português: Trata ver mais no mês; false impede a abertura padrão.
   */
  onMonthMoreClick?: (info: MonthMoreInfo) => void | false;
  /** Handle timed overflow; false suppresses the built-in opening.
   * @remarks Português: Trata ver mais na grade de horário; false impede a abertura padrão.
   */
  onEventMoreClick?: (info: MonthMoreInfo) => void | false;
  /** Navigate to a date and a registered view.
   * @remarks Português: Navega para uma data e uma view registrada.
   */
  openDateView?: (dateISO: string, viewName: string) => void;
  /** Activate an occurrence in the consumer flow.
   * @remarks Português: Ativa uma ocorrência no fluxo do consumidor.
   */
  onEventClick?: (occurrence: EventOccurrence) => void;
  /** Activate an empty date or minute-of-day slot.
   * @remarks Português: Ativa uma data vazia ou slot em minutos do dia.
   */
  onDateClick?: (dateISO: string, minuteOfDay?: number) => void;
}

/** Inputs for navigation between view ranges. @remarks Português: Entradas da navegação entre períodos da view. */
export interface ViewNavigationInput {
  /** Move to the previous or next range. @remarks Português: Move ao período anterior ou próximo. */
  direction: 'prev' | 'next';
  /** Current reference date. @remarks Português: Data de referência atual. */
  date: PlainDate;
  /** Resolved date utilities and options. @remarks Português: Utilitários de datas e opções resolvidos. */
  context: ViewContext;
}

/** Registered date logic and native React rendering contract.
 * @remarks Português: Contrato registrado de datas e renderização React nativa.
 */
export interface CalendarView {
  /** Unique registered view name.
   * @remarks Português: Nome único da view registrada.
   */
  name: string;
  /** Display label used by the toolbar.
   * @remarks Português: Rótulo exibido na toolbar.
   */
  label: string;
  /** Resolve visible dates and inclusive endpoints.
   * @remarks Português: Resolve datas visíveis e extremos inclusivos.
   */
  getRange(date: PlainDate, context: ViewContext): ViewRange;
  /** Resolve the reference date after previous or next navigation.
   * @remarks Português: Resolve a data após navegar para anterior ou próximo.
   */
  navigate(input: ViewNavigationInput): PlainDate;
  /** Format the title for the resolved range.
   * @remarks Português: Formata o título do período resolvido.
   */
  getTitle(range: ViewRange, context: ViewContext): string;
  /** Render the view body as native React content.
   * @remarks Português: Renderiza o corpo da view com React nativo.
   */
  render(context: ViewRenderContext): ReactNode;
}

/** Active range, available views and navigation actions.
 * @remarks Português: Período ativo, views disponíveis e ações de navegação.
 */
export interface ToolbarContext {
  /** Formatted title of the active range.
   * @remarks Português: Título formatado do período ativo.
   */
  title: string;
  /** Active registered view name.
   * @remarks Português: Nome da view registrada ativa.
   */
  viewName: string;
  /** Available view names and labels.
   * @remarks Português: Nomes e rótulos das views disponíveis.
   */
  views: {
    /** Registered view identifier. @remarks Português: Identificador da view registrada. */
    name: string;
    /** Display text. @remarks Português: Texto exibido. */
    label: string;
  }[];
  /** Navigate to the previous view range.
   * @remarks Português: Navega para o período anterior da view.
   */
  goPrev(): void;
  /** Navigate to the next view range.
   * @remarks Português: Navega para o próximo período da view.
   */
  goNext(): void;
  /** Navigate to today in the calendar time zone.
   * @remarks Português: Navega para hoje no fuso do calendário.
   */
  goToday(): void;
  /** Activate a registered view.
   * @remarks Português: Ativa uma view registrada.
   */
  changeView(name: string): void;
}

/** Render a replacement toolbar.
 * @remarks Português: Renderiza uma toolbar substituta.
 */
export type ToolbarRenderSlot = (context: ToolbarContext) => ReactNode;
