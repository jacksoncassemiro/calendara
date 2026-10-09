/** Time-grid presentation data. @remarks Português: Dados de apresentação da grade de horários. */
import type { ReactNode, CSSProperties } from 'react';
import type { ViewRenderContext } from '../../viewTypes.js';
import type { DenseOverflowGroup } from '../layout/denseLayout.js';
import type { GeoBlock } from '../../../core/index.js';
import type { Segment } from '../../../core/index.js';

export interface EventVM {
  /** Show the start resize handle. @remarks Português: Exibe a alça de início. */
  resizeStart?: boolean;
  /** Show the end resize handle. @remarks Português: Exibe a alça de término. */
  resizeEnd?: boolean;
  /** Activate the rendered occurrence. @remarks Português: Ativa a ocorrência renderizada. */
  activate?: () => void;
  /** Stable rendered occurrence ID. @remarks Português: ID estável da ocorrência renderizada. */
  id: string;
  /** Positioned event geometry. @remarks Português: Geometria posicionada do evento. */
  block: GeoBlock;
  /** Visible event title. @remarks Português: Título visível do evento. */
  title: string;
  /** Formatted start time. @remarks Português: Horário inicial formatado. */
  timeLabel: string;
  /** Optional event accent color. @remarks Português: Cor opcional da faixa do evento. */
  color?: string;
  /** Inclusive start in minutes of day. @remarks Português: Início inclusivo em minutos do dia. */
  startMin: number;
  /** Exclusive end in minutes of day. @remarks Português: Fim exclusivo em minutos do dia. */
  endMin: number;
  /** Allow movement and resizing. @remarks Português: Permite mover e redimensionar. */
  editable: boolean;
  /** Consumer card content; omitted uses defaults. @remarks Português: Conteúdo do consumidor; ausente usa o padrão. */
  content?: ReactNode;
}

export interface AllDayVM {
  /** Inclusive original all-day date. @remarks Português: Data original inclusiva de dia inteiro. */
  startDate?: string;
  /** Exclusive original all-day date. @remarks Português: Data original exclusiva de dia inteiro. */
  endDate?: string;
  /** Allow movement and resizing. @remarks Português: Permite mover e redimensionar. */
  editable?: boolean;
  /** Activate the rendered occurrence. @remarks Português: Ativa a ocorrência renderizada. */
  activate?: () => void;
  /** Stable rendered occurrence ID. @remarks Português: ID estável da ocorrência renderizada. */
  id: string;
  /** Visible event title. @remarks Português: Título visível do evento. */
  title: string;
  /** Optional event accent color. @remarks Português: Cor opcional da faixa do evento. */
  color?: string;
  /** Consumer card content; omitted uses defaults. @remarks Português: Conteúdo do consumidor; ausente usa o padrão. */
  content?: ReactNode;
}

export interface DayColumnVM {
  /** Consumer day decoration. @remarks Português: Decoração do dia pelo consumidor. */
  dayStyle?: CSSProperties;
  /** Minimum column width in px. @remarks Português: Largura mínima da coluna em px. */
  minWidth?: number;
  /** Groups represented by +more. @remarks Português: Grupos representados por ver mais. */
  overflowGroups?: DenseOverflowGroup[];
  /** Display date, YYYY-MM-DD. @remarks Português: Data exibida, YYYY-MM-DD. */
  dateISO: string;
  /** Localized weekday caption. @remarks Português: Legenda traduzida do dia da semana. */
  weekdayLabel: string;
  /** Localized date number. @remarks Português: Número traduzido da data. */
  dayLabel: string;
  /** Today in the display time zone. @remarks Português: Hoje no fuso de exibição. */
  isToday: boolean;
  /** Outside-business-hour segments. @remarks Português: Segmentos fora do expediente. */
  nonBusiness: Segment[];
  /** Blocked scheduling segments. @remarks Português: Segmentos bloqueados para agendamento. */
  blocked: Segment[];
  /** All-day cards or draft mode. @remarks Português: Cartões de dia inteiro ou modo do rascunho. */
  allDay: AllDayVM[];
  /** Timed cards in this column. @remarks Português: Cartões com horário nesta coluna. */
  events: EventVM[];
  /** Current-time line in minutes; null when hidden. @remarks Português: Linha atual em minutos; null se oculta. */
  nowMinutes: number | null;
}

export interface HourLabelVM {
  /** Minutes since midnight. @remarks Português: Minutos desde meia-noite. */
  min: number;
  /** Formatted time-axis caption. @remarks Português: Legenda formatada do eixo de horários. */
  label: string;
}

export interface DraftVM {
  /** Occurrence being moved or resized. @remarks Português: Ocorrência movida ou redimensionada. */
  eventId?: string;
  /** Visible event title. @remarks Português: Título visível do evento. */
  title?: string;
  /** Optional event accent color. @remarks Português: Cor opcional da faixa do evento. */
  color?: string;
  /** Draft end date when crossing midnight. @remarks Português: Data final ao atravessar meia-noite. */
  endDateISO?: string;
  /** All-day cards or draft mode. @remarks Português: Cartões de dia inteiro ou modo do rascunho. */
  allDay?: boolean;
  /** Display date, YYYY-MM-DD. @remarks Português: Data exibida, YYYY-MM-DD. */
  dateISO: string;
  /** Inclusive start in minutes of day. @remarks Português: Início inclusivo em minutos do dia. */
  startMin: number;
  /** Exclusive end in minutes of day. @remarks Português: Fim exclusivo em minutos do dia. */
  endMin: number;
  /** Gesture creating the preview. @remarks Português: Gesto que cria a prévia. */
  kind: 'move' | 'resize' | 'select';
  /** Placement passes scheduling validation. @remarks Português: Posicionamento aprovado pelas regras. */
  valid: boolean;
}

export interface GridVM {
  /** Live calendar data and callbacks. @remarks Português: Dados e callbacks atuais do calendário. */
  context?: ViewRenderContext;
  /** Registered view identity. @remarks Português: Identidade da view registrada. */
  viewName: string;
  /** Visible start in decimal hours. @remarks Português: Início visível em horas decimais. */
  startHour: number;
  /** Exclusive visible end in decimal hours. @remarks Português: Fim visível exclusivo em horas decimais. */
  endHour: number;
  /** Vertical pixels per minute. @remarks Português: Pixels verticais por minuto. */
  pxPerMinute: number;
  /** Selectable division in minutes. @remarks Português: Divisão selecionável em minutos. */
  slotMinutes: number;
  /** Visible time-axis labels. @remarks Português: Rótulos visíveis do eixo de horários. */
  hourLabels: HourLabelVM[];
  /** Visible date columns in order. @remarks Português: Colunas de datas visíveis em ordem. */
  columns: DayColumnVM[];
  /** Current gesture preview, if visible. @remarks Português: Prévia do gesto atual, se visível. */
  draft?: DraftVM;
}
