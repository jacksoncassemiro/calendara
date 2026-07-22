/**
 * Tipos de data/hora canônicos.
 * Baseado em docs/reference/data-model-mapping.md (superconjunto RFC 5545 / Google / Outlook).
 */

/** Código de dia da semana RFC 5545. */
export type WeekdayCode = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';

/** Instante ou data de um extremo de evento (espelha Google `start`/`end`). */
export interface EventDateTime {
  /** 'YYYY-MM-DD' — presente quando all-day. */
  date?: string;
  /** ISO 8601 com offset — presente quando timed. */
  dateTime?: string;
  /** Timezone IANA, ex.: 'America/Sao_Paulo'. */
  timeZone?: string;
}

/** Janela temporal de um evento. Em all-day, `end` é EXCLUSIVO (convenção Google). */
export interface EventTime {
  allDay: boolean;
  start: EventDateTime;
  end: EventDateTime;
}
