/**
 * Modelo de recorrência canônico — fiel ao RFC 5545.
 * Diferença crítica vs protótipo: `byDay` guarda um ORDINAL POR ENTRADA
 * (`{ weekday, ordinal }`) em vez de um `bySetPos` global — é o que permite
 * "2ª e 4ª sexta" (`[{FR,2},{FR,4}]`). Ver docs/reference/recurrence-validation.md.
 */
import type { WeekdayCode } from './datetime.js';
import type { CalendarEvent } from './event.js';

export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

/** Entrada de BYDAY: dia da semana com ordinal opcional (2FR, 4FR, -1MO). */
export interface ByDayEntry {
  weekday: WeekdayCode;
  /** Ordinal (1..53 ou -1..-53). Ausente/undefined = todas as ocorrências do weekday. */
  ordinal?: number;
}

export interface RRuleModel {
  freq: Frequency;
  /** INTERVAL — default 1. */
  interval?: number;
  /** COUNT — número total de ocorrências. */
  count?: number;
  /** UNTIL — 'YYYY-MM-DD' ou ISO datetime. Limite inclusivo. */
  until?: string;
  /** BYDAY com ordinal por entrada. */
  byDay?: ByDayEntry[];
  /** BYMONTHDAY — pode ser negativo (-1 = último dia do mês). */
  byMonthDay?: number[];
  /** BYMONTH — 1..12. */
  byMonth?: number[];
  /** BYSETPOS — seleção posicional dentro do período. */
  bySetPos?: number[];
  /** WKST — início da semana (default MO). */
  weekStart?: WeekdayCode;
}

/** Marca de cancelamento de uma ocorrência específica. */
export interface CancelledOverride {
  cancelled: true;
}

export type OccurrenceOverride = Partial<CalendarEvent> | CancelledOverride;

/**
 * Conjunto de recorrência (recurrence-set): a regra + datas extras/exceções + overrides.
 * A expansão gera OCORRÊNCIAS VIRTUAIS (não persistidas); `overrides` edita/cancela uma instância.
 */
export interface Recurrence {
  /** Regra estruturada, ou uma string RRULE bruta em cenário de interop. */
  rule?: RRuleModel | string;
  /** RDATE — datas adicionais ('YYYY-MM-DD' ou ISO datetime). */
  rDates?: string[];
  /** EXDATE — ocorrências removidas ('YYYY-MM-DD' ou ISO datetime). */
  exDates?: string[];
  /** Overrides por ocorrência. Chave = originalStart (ISO) da ocorrência. */
  overrides?: Record<string, OccurrenceOverride>;
}

export function isCancelledOverride(o: OccurrenceOverride): o is CancelledOverride {
  return (o as CancelledOverride).cancelled === true;
}
