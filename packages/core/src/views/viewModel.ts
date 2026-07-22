/**
 * View model do time-grid: estrutura 100% de dados que o CalendarApp entrega ao componente
 * Preact. O componente é "burro" — só desenha isto. Facilita testar (asserção sobre o VM) e
 * escrever views novas.
 */
import type { ComponentChildren } from 'preact';
import type { GeoBlock } from '../geometry/geometry.js';
import type { Segment } from '../render/derive.js';

export interface EventVM {
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
  content?: ComponentChildren;
}

export interface AllDayVM {
  id: string;
  title: string;
  color?: string;
  /** Conteúdo customizado (slot renderEvent); ausente = layout padrão. */
  content?: ComponentChildren;
}

export interface DayColumnVM {
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
  dateISO: string;
  startMin: number;
  endMin: number;
  kind: 'move' | 'resize' | 'select';
  /** Slot válido (drop permitido) → estilo distinto de inválido. */
  valid: boolean;
}

export interface GridVM {
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
