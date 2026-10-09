import type {
  BusinessHours,
  Blocking,
  DateRange,
  ConstraintSet,
  SlotEvaluation,
} from '../types/index.js';
import { hhmmToMinutes } from '../date/time.js';

/** Date and optional minute interval to validate.
 * @remarks Português: Data e intervalo opcional em minutos para validar.
 */
export interface Slot {
  /** Calendar date in YYYY-MM-DD format.
   * @remarks Português: Data do calendário em YYYY-MM-DD.
   */
  date: string;

  /** Inclusive minute of day, 0..1439; omitted means a whole-day slot.
   * @remarks Português: Minuto inicial inclusivo, 0..1439; ausente representa slot de dia inteiro.
   */
  startMin?: number;

  /** Exclusive minute of day; omitted uses startMin.
   * @remarks Português: Minuto final exclusivo; ausente usa startMin.
   */
  endMin?: number;
}

const DAY_START_MIN = 0;
const DAY_END_MIN = 24 * 60;

/** ISO date weekday: 0 is Sunday, 6 is Saturday.
 * @remarks Português: Dia da semana da data ISO: 0 é domingo, 6 é sábado.
 */
export function jsDayOfWeek(dateISO: string): number {
  const [year, month, day] = dateISO.split('-').map((token) => parseInt(token, 10));
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1)).getUTCDay();
}

function overlaps({
  firstStart,
  firstEnd,
  secondStart,
  secondEnd,
}: {
  /** Inclusive first interval start in minutes. @remarks Português: Início inclusivo do primeiro intervalo em minutos. */
  firstStart: number;
  /** Exclusive first interval end in minutes. @remarks Português: Fim exclusivo do primeiro intervalo em minutos. */
  firstEnd: number;
  /** Inclusive second interval start in minutes. @remarks Português: Início inclusivo do segundo intervalo em minutos. */
  secondStart: number;
  /** Exclusive second interval end in minutes. @remarks Português: Fim exclusivo do segundo intervalo em minutos. */
  secondEnd: number;
}): boolean {
  return firstStart < secondEnd && secondStart < firstEnd;
}

function slotMinutes(slot: Slot): { start: number; end: number; wholeDay: boolean } {
  const isWholeDay = slot.startMin === undefined;
  if (isWholeDay) return { start: DAY_START_MIN, end: DAY_END_MIN, wholeDay: true };
  const start = slot.startMin!;
  const end = slot.endMin ?? slot.startMin!;
  return { start, end: Math.max(end, start), wholeDay: false };
}

/** Evaluate allowed hours and ranges; explicit blocks take precedence.
 * @remarks Português: Avalia expediente e faixas permitidas; bloqueios explícitos têm precedência.
 */
export class ConstraintEngine {
  private businessHours: BusinessHours[];
  private allowedRanges: DateRange[];
  private blocked: Blocking[];

  constructor(constraintSet: ConstraintSet = {}) {
    this.businessHours = constraintSet.businessHours ?? [];
    this.allowedRanges = constraintSet.allowedRanges ?? [];
    this.blocked = constraintSet.blocked ?? [];
  }

  /** Replace rules used by subsequent evaluations.
   * @remarks Português: Substitui as regras usadas nas próximas avaliações.
   */
  update(constraintSet: ConstraintSet): void {
    this.businessHours = constraintSet.businessHours ?? [];
    this.allowedRanges = constraintSet.allowedRanges ?? [];
    this.blocked = constraintSet.blocked ?? [];
  }

  private isBlocked(slot: Slot): boolean {
    const { start, end } = slotMinutes(slot);
    for (const blocking of this.blocked) {
      const appliesToThisDay = blocking.date === slot.date;
      if (!appliesToThisDay) continue;
      const blocksWholeDay = blocking.scope === 'day';
      if (blocksWholeDay) return true;
      const blockStart = blocking.startTime ? hhmmToMinutes(blocking.startTime) : DAY_START_MIN;
      const blockEnd = blocking.endTime ? hhmmToMinutes(blocking.endTime) : DAY_END_MIN;
      const overlapsBlock = overlaps({
        firstStart: start,
        firstEnd: end,
        secondStart: blockStart,
        secondEnd: blockEnd,
      });
      if (overlapsBlock) return true;
    }
    return false;
  }

  private inBusinessHours(slot: Slot): boolean {
    const hasBusinessRule = this.businessHours.length > 0;
    if (!hasBusinessRule) return true;
    const dayOfWeek = jsDayOfWeek(slot.date);
    const { start, end, wholeDay } = slotMinutes(slot);
    for (const businessHour of this.businessHours) {
      const appliesToWeekday = businessHour.daysOfWeek.includes(dayOfWeek);
      const beforeRuleValidity = businessHour.start !== undefined && slot.date < businessHour.start;
      const afterRuleValidity = businessHour.end !== undefined && slot.date > businessHour.end;
      const ruleApplies = appliesToWeekday && !beforeRuleValidity && !afterRuleValidity;
      if (!ruleApplies) continue;
      if (wholeDay) return true;
      const businessStart = hhmmToMinutes(businessHour.startTime);
      const businessEnd = hhmmToMinutes(businessHour.endTime);
      const withinBusinessWindow = start >= businessStart && end <= businessEnd;
      if (withinBusinessWindow) return true;
    }
    return false;
  }

  private inAllowed(slot: Slot): boolean {
    const hasAllowedRule = this.allowedRanges.length > 0;
    if (!hasAllowedRule) return true;
    const { start, end, wholeDay } = slotMinutes(slot);
    for (const range of this.allowedRanges) {
      const withinDateRange = slot.date >= range.start && slot.date <= range.end;
      if (!withinDateRange) continue;
      if (wholeDay) return true;
      const rangeStart = range.startTime ? hhmmToMinutes(range.startTime) : DAY_START_MIN;
      const rangeEnd = range.endTime ? hhmmToMinutes(range.endTime) : DAY_END_MIN;
      const withinAllowedWindow = start >= rangeStart && end <= rangeEnd;
      if (withinAllowedWindow) return true;
    }
    return false;
  }

  /** Evaluate availability and report the first rejection reason.
   * @remarks Português: Avalia disponibilidade e informa o primeiro motivo de recusa.
   */
  evaluate(slot: Slot): SlotEvaluation {
    if (this.isBlocked(slot)) return { valid: false, reason: 'blocked' };
    if (!this.inBusinessHours(slot)) return { valid: false, reason: 'outside-business-hours' };
    if (!this.inAllowed(slot)) return { valid: false, reason: 'outside-allowed' };
    return { valid: true, reason: 'ok' };
  }

  /** Whether the slot satisfies current rules.
   * @remarks Português: Indica se o slot atende às regras atuais.
   */
  isValid(slot: Slot): boolean {
    return this.evaluate(slot).valid;
  }
}

/** Named inputs for hasAvailableTime.
 * @remarks Português: Entradas nomeadas de hasAvailableTime.
 */
export interface HasAvailableTimeInput {
  /** Availability rules to evaluate.
   * @remarks Português: Regras de disponibilidade a avaliar.
   */
  constraints: ConstraintSet;
  /** Evaluated ISO date in YYYY-MM-DD.
   * @remarks Português: Data ISO avaliada em YYYY-MM-DD.
   */
  date: string;
  /** Inclusive minute-of-day window start.
   * @remarks Português: Início inclusivo da janela em minutos do dia.
   */
  startMin: number;
  /** Exclusive minute-of-day window end.
   * @remarks Português: Fim exclusivo da janela em minutos do dia.
   */
  endMin: number;
}

/** Whether any positive interval is available in the displayed minute window.
 * @remarks Português: Indica se existe intervalo positivo disponível na janela visível em minutos.
 */

export function hasAvailableTime({
  constraints,
  date,
  startMin,
  endMin,
}: HasAvailableTimeInput): boolean {
  const engine = new ConstraintEngine(constraints);
  const boundaries = new Set([startMin, endMin]);
  const add = (value: string | undefined): void => {
    if (value === undefined) return;
    const minute = hhmmToMinutes(value);
    if (minute > startMin && minute < endMin) boundaries.add(minute);
  };
  for (const rule of constraints.businessHours ?? []) {
    add(rule.startTime);
    add(rule.endTime);
  }
  for (const rule of constraints.allowedRanges ?? []) {
    add(rule.startTime);
    add(rule.endTime);
  }
  for (const rule of constraints.blocked ?? []) {
    add(rule.startTime);
    add(rule.endTime);
  }
  const minutes = [...boundaries].sort((a, b) => a - b);
  return minutes
    .slice(1)
    .some(
      (end, index) =>
        end > minutes[index]! && engine.isValid({ date, startMin: minutes[index]!, endMin: end }),
    );
}
