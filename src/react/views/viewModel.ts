/**
 * View model do time-grid: estrutura 100% de dados que o CalendarApp entrega ao componente
 * React. O componente é "burro" — só desenha isto. Facilita testar (asserção sobre o VM) e
 * escrever views novas.
 */
import type { ReactNode } from 'react';
import type { GeoBlock } from '../../core/index.js';
import type { Segment } from '../../core/index.js';

export interface EventVM {
  resizeStart?: boolean;
  resizeEnd?: boolean;
  activate?: () => void;
  id: string;
  block: GeoBlock;
  title: string;
  timeLabel: string;
  color?: string;
  /** Minuto-do-dia do início (fonte da interação de mover/redimensionar). */
  startMin: number;
  /** Minuto-do-dia do fim. */
  endMin: number;
  /** `event.editable !== false` — habilita arrasto/redimensionamento e a alça. */
  editable: boolean;
  /** Conteúdo customizado (slot renderEvent); ausente = layout padrão. */
  content?: ReactNode;
}

export interface AllDayVM {
  startDate?: string;
  endDate?: string;
  editable?: boolean;
  activate?: () => void;
  id: string;
  title: string;
  color?: string;
  /** Conteúdo customizado (slot renderEvent); ausente = layout padrão. */
  content?: ReactNode;
}

export interface DayColumnVM {
  dayStyle?: import("react").CSSProperties;
  minWidth?: number;
  overflowGroups?: import("./denseLayout.js").DenseOverflowGroup[];
  dateISO: string;
  weekdayLabel: string;
  dayLabel: string;
  isToday: boolean;
  nonBusiness: Segment[];
  blocked: Segment[];
  allDay: AllDayVM[];
  events: EventVM[];
  /** Minuto-do-dia da linha "agora" se for hoje e estiver dentro do grid; senão null. */
  nowMinutes: number | null;
}

export interface HourLabelVM {
  min: number;
  label: string;
}

/** Fantasma do gesto em andamento (drag/resize/select) — desenhado na coluna correspondente. */
export interface DraftVM {
  eventId?: string;
  title?: string;
  color?: string;
  endDateISO?: string;
  allDay?: boolean;
  dateISO: string;
  startMin: number;
  endMin: number;
  kind: 'move' | 'resize' | 'select';
  /** Slot válido (drop permitido) → estilo distinto de inválido. */
  valid: boolean;
}

export interface GridVM {
  context?: import("./viewDef.js").ViewRenderContext;
  viewName: string;
  startHour: number;
  endHour: number;
  pxPerMinute: number;
  slotMinutes: number;
  hourLabels: HourLabelVM[];
  columns: DayColumnVM[];
  /** Fantasma do gesto atual (se houver e cair num dia visível). */
  draft?: DraftVM;
}
