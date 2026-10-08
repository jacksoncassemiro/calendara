/** Supported recurrence rules and occurrence exceptions.
 * @remarks Português: Regras de recorrência suportadas e exceções por ocorrência.
 */
import type { WeekdayCode } from './datetime.js';
import type { CalendarEvent } from './event.js';

/** Supported daily, weekly, monthly or yearly recurrence.
 * @remarks Português: Frequências diária, semanal, mensal ou anual suportadas.
 */
export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

/** Weekday filter with an optional position.
 * @remarks Português: Filtro de dia da semana com posição opcional.
 */
export interface ByDayEntry {
  /** RFC weekday code, such as MO or FR.
   * @remarks Português: Código RFC do dia da semana, como MO ou FR.
   */
  weekday: WeekdayCode;
  /** Weekday position: ±1..53; omitted matches every weekday occurrence.
   * @remarks Português: Posição do dia: ±1..53; ausente seleciona todas as ocorrências desse dia.
   */
  ordinal?: number;
}

/** Supported structured RFC 5545 recurrence fields.
 * @remarks Português: Campos estruturados de recorrência RFC 5545 suportados.
 */
export interface RRuleModel {
  /** Supported recurrence frequency.
   * @remarks Português: Frequência de repetição suportada.
   */
  freq: Frequency;
  /** Positive period step; default 1.
   * @remarks Português: Passo positivo entre períodos; padrão 1.
   */
  interval?: number;
  /** Positive occurrence count before exclusions.
   * @remarks Português: Quantidade positiva de ocorrências antes das exclusões.
   */
  count?: number;
  /** Inclusive limit in YYYY-MM-DD or ISO datetime format.
   * @remarks Português: Limite inclusivo em YYYY-MM-DD ou data e hora ISO.
   */
  until?: string;
  /** Weekday filter with an optional ordinal per entry.
   * @remarks Português: Filtro de dias da semana com posição opcional por entrada.
   */
  byDay?: ByDayEntry[];
  /** Month days ±1..31; -1 means the last day.
   * @remarks Português: Dias do mês ±1..31; -1 representa o último dia.
   */
  byMonthDay?: number[];
  /** Month filter using 1..12.
   * @remarks Português: Filtro de meses de 1 a 12.
   */
  byMonth?: number[];
  /** Year days ±1..366; supported only for YEARLY.
   * @remarks Português: Dias do ano ±1..366; disponível somente em YEARLY.
   */
  byYearDay?: number[];
  /** Candidate positions within each period: ±1..366.
   * @remarks Português: Posições dos candidatos em cada período: ±1..366.
   */
  bySetPos?: number[];
  /** Week boundary for weekly rules; default MO.
   * @remarks Português: Início da semana para regras semanais; padrão MO.
   */
  weekStart?: WeekdayCode;
}

/** Cancellation marker for one occurrence.
 * @remarks Português: Marca o cancelamento de uma ocorrência.
 */
export interface CancelledOverride {
  /** Remove this occurrence from the expanded series.
   * @remarks Português: Remove esta ocorrência da série expandida.
   */
  cancelled: true;
}

/** Occurrence-specific event patch or cancellation.
 * @remarks Português: Alteração ou cancelamento de uma ocorrência.
 */
export type OccurrenceOverride = Partial<CalendarEvent> | CancelledOverride;

/** Rule, extra dates, exclusions and occurrence patches.
 * @remarks Português: Regra, datas extras, exclusões e alterações por ocorrência.
 */
export interface Recurrence {
  /** Structured rule or RRULE text; omitted permits RDATE-only sets.
   * @remarks Português: Regra estruturada ou texto RRULE; ausente permite conjuntos somente com
   * RDATE.
   */
  rule?: RRuleModel | string;
  /** Additional starts in YYYY-MM-DD or ISO datetime format.
   * @remarks Português: Inícios adicionais em YYYY-MM-DD ou data e hora ISO.
   */
  rDates?: string[];
  /** Excluded starts in YYYY-MM-DD or ISO datetime format.
   * @remarks Português: Inícios excluídos em YYYY-MM-DD ou data e hora ISO.
   */
  exDates?: string[];
  /** Occurrence patches keyed by the unchanged originalStart.
   * @remarks Português: Alterações por ocorrência, indexadas pelo originalStart preservado.
   */
  overrides?: Record<string, OccurrenceOverride>;
}

/** Check whether an occurrence patch cancels its instance.
 * @remarks Português: Verifica se a alteração cancela a ocorrência.
 */
export function isCancelledOverride(override: OccurrenceOverride): override is CancelledOverride {
  return (override as CancelledOverride).cancelled === true;
}
