/**
 * Evento canônico. Superconjunto RFC 5545, interoperável com Google/Outlook.
 * Ver docs/reference/data-model-mapping.md.
 */
import type { EventTime } from './datetime.js';
import type { Recurrence } from './recurrence.js';

export interface CalendarEvent {
  id: string;
  /** Múltiplas agendas. */
  calendarId: string;
  title: string;
  description?: string;
  time: EventTime;
  /** Override de cor; senão herda a cor do calendar. */
  color?: string;
  /** Default true. */
  editable?: boolean;
  recurrence?: Recurrence;
  /** 0..N recursos que o evento ocupa (genérico). */
  resourceIds?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Ocorrência virtual expandida de uma série recorrente (não persistida).
 * Referencia o evento-mestre e carrega o instante original para casar com overrides/exDates.
 */
export interface EventOccurrence {
  /** Evento efetivo desta ocorrência (mestre + override aplicado). */
  event: CalendarEvent;
  /** id do evento-mestre. */
  masterId: string;
  /** ISO do início original desta ocorrência (chave de override/exDate). */
  originalStart: string;
  /** true quando esta ocorrência é o próprio evento não-recorrente. */
  isMaster: boolean;
}
