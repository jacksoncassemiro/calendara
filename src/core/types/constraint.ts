/** Inclusive ISO date range.
 * @remarks Português: Faixa de datas ISO com extremos inclusivos.
 */
export interface DateRangeBounds {
  /** Inclusive first date in YYYY-MM-DD format.
   * @remarks Português: Primeira data inclusiva em YYYY-MM-DD.
   */
  start: string;
  /** Inclusive last date in YYYY-MM-DD format.
   * @remarks Português: Última data inclusiva em YYYY-MM-DD.
   */
  end: string;
}

/** Local-time interval with an exclusive end.
 * @remarks Português: Faixa de horário local com fim exclusivo.
 */
export interface TimeOfDayRange {
  /** Inclusive start in HH:mm format.
   * @remarks Português: Início inclusivo em HH:mm.
   */
  startTime: string;
  /** Exclusive end in HH:mm format; 24:00 ends the day.
   * @remarks Português: Fim exclusivo em HH:mm; 24:00 encerra o dia.
   */
  endTime: string;
}

/** Weekly business hours with optional date validity.
 * @remarks Português: Expediente semanal com validade opcional por data.
 */
export interface BusinessHours extends TimeOfDayRange {
  /** Applicable weekdays: 0 is Sunday and 6 is Saturday.
   * @remarks Português: Dias aplicáveis: 0 é domingo e 6 é sábado.
   */
  daysOfWeek: number[];
  /** Inclusive first valid date; omitted has no lower bound.
   * @remarks Português: Primeira data válida, inclusiva; ausente não limita o início.
   */
  start?: string;
  /** Inclusive last valid date; omitted has no upper bound.
   * @remarks Português: Última data válida, inclusiva; ausente não limita o fim.
   */
  end?: string;
}

/** Allowed dates with optional time-of-day bounds.
 * @remarks Português: Datas permitidas com limites opcionais de horário.
 */
export interface DateRange extends DateRangeBounds {
  /** Optional inclusive time bound in HH:mm format.
   * @remarks Português: Limite de horário inicial inclusivo em HH:mm.
   */
  startTime?: string;
  /** Optional exclusive time bound in HH:mm format.
   * @remarks Português: Limite de horário final exclusivo em HH:mm.
   */
  endTime?: string;
}

/** Day or time block, taking precedence over availability.
 * @remarks Português: Bloqueio de dia ou horário com precedência sobre a disponibilidade.
 */
export interface Blocking {
  /** Block a whole day or a time interval.
   * @remarks Português: Bloqueia o dia inteiro ou uma faixa de horário.
   */
  scope: 'day' | 'time';
  /** Blocked date in YYYY-MM-DD format.
   * @remarks Português: Data bloqueada em YYYY-MM-DD.
   */
  date: string;
  /** Time-block start in HH:mm format; omitted means 00:00.
   * @remarks Português: Início do bloqueio de horário em HH:mm; ausente usa 00:00.
   */
  startTime?: string;
  /** Exclusive time-block end; omitted means 24:00.
   * @remarks Português: Fim exclusivo do bloqueio de horário; ausente usa 24:00.
   */
  endTime?: string;
  /** Optional label for consumer presentation.
   * @remarks Português: Rótulo opcional para apresentação pelo consumidor.
   */
  description?: string;
}

/** Availability rules for a calendar or resource.
 * @remarks Português: Regras de disponibilidade de calendário ou recurso.
 */
export interface ConstraintSet {
  /** Permitted weekly hours; absent or empty adds no hour restriction.
   * @remarks Português: Expediente permitido; ausente ou vazio não restringe horários.
   */
  businessHours?: BusinessHours[];
  /** Allowed date/time ranges; absent or empty adds no range restriction.
   * @remarks Português: Faixas permitidas; ausente ou vazio não restringe o período.
   */
  allowedRanges?: DateRange[];
  /** Forbidden intervals, taking precedence over allowed hours.
   * @remarks Português: Intervalos proibidos, com precedência sobre horários permitidos.
   */
  blocked?: Blocking[];
}

/** Result of evaluating slot availability.
 * @remarks Português: Resultado da avaliação de disponibilidade do slot.
 */
export interface SlotEvaluation {
  /** Whether the slot satisfies the applicable constraints.
   * @remarks Português: Indica se o slot atende às regras aplicáveis.
   */
  valid: boolean;
  /** Constraint evaluation reason.
   * @remarks Português: Motivo da aprovação ou recusa pelas regras.
   */
  reason?: 'blocked' | 'outside-business-hours' | 'outside-allowed' | 'ok';
}
