/**
 * View model do time-grid: estrutura 100% de dados que o CalendarApp entrega ao componente
 * Preact. O componente é "burro" — só desenha isto. Facilita testar (asserção sobre o VM) e
 * escrever views novas.
 */
import type { GeoBlock } from '../geometry/geometry.js';
import type { Segment } from '../render/derive.js';

export interface EventVM {
  id: string;
  block: GeoBlock;
  title: string;
  timeLabel: string;
  color?: string;
}

export interface AllDayVM {
  id: string;
  title: string;
  color?: string;
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

export interface GridVM {
  title: string;
  viewName: string;
  locale: string;
  startHour: number;
  endHour: number;
  pxPerMinute: number;
  slotMinutes: number;
  hourLabels: HourLabelVM[];
  columns: DayColumnVM[];
}
