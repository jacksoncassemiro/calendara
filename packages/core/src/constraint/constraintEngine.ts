/**
 * ConstraintEngine — responde "esse slot é válido?" para drag/drop/click (ADR-005).
 * Regra: válido ⇔ businessHours ∧ (sem allowedRanges OU dentro de allowedRanges) ∧ ¬blocked.
 * `blocked` tem precedência sobre tudo.
 *
 * Trabalha em minutos-do-dia + data ('YYYY-MM-DD') — puro, sem dependência de Temporal,
 * para ser barato de chamar em cada movimento de ponteiro. `daysOfWeek` de BusinessHours usa
 * 0=domingo..6=sábado (convenção JS/FullCalendar).
 */
import type {
  BusinessHours,
  Blocking,
  DateRange,
  ConstraintSet,
  SlotEvaluation,
} from '../types/index.js';
import { hhmmToMinutes } from '../date/time.js';

/** Slot a avaliar: uma data e (opcional) faixa de horário em minutos. */
export interface Slot {
  /** 'YYYY-MM-DD'. */
  date: string;
  /** minuto do dia (0..1439). Ausente = dia inteiro. */
  startMin?: number;
  /** minuto do dia final (exclusivo). Ausente = usa startMin. */
  endMin?: number;
}

/** Meia-noite (minuto 0) e fim do dia (24h = 1440) em minutos-do-dia. */
const DAY_START_MIN = 0;
const DAY_END_MIN = 24 * 60;

/** dia-da-semana JS (0=dom..6=sáb) de uma data 'YYYY-MM-DD' (UTC-safe, sem tz). */
export function jsDayOfWeek(dateISO: string): number {
  const [year, month, day] = dateISO.split('-').map((token) => parseInt(token, 10));
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1)).getUTCDay();
}

function overlaps(
  firstStart: number,
  firstEnd: number,
  secondStart: number,
  secondEnd: number,
): boolean {
  return firstStart < secondEnd && secondStart < firstEnd;
}

/** Normaliza o slot para [start,end) em minutos; dia inteiro vira [0,1440). */
function slotMinutes(slot: Slot): { start: number; end: number; wholeDay: boolean } {
  const isWholeDay = slot.startMin === undefined;
  if (isWholeDay) return { start: DAY_START_MIN, end: DAY_END_MIN, wholeDay: true };
  const start = slot.startMin!;
  const end = slot.endMin ?? slot.startMin!;
  return { start, end: Math.max(end, start), wholeDay: false };
}

export class ConstraintEngine {
  private businessHours: BusinessHours[];
  private allowedRanges: DateRange[];
  private blocked: Blocking[];

  constructor(constraintSet: ConstraintSet = {}) {
    this.businessHours = constraintSet.businessHours ?? [];
    this.allowedRanges = constraintSet.allowedRanges ?? [];
    this.blocked = constraintSet.blocked ?? [];
  }

  /** Substitui o conjunto de constraints (imutável por chamada). */
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
      // scope 'time'
      const blockStart = blocking.start ? hhmmToMinutes(blocking.start) : DAY_START_MIN;
      const rawBlockEnd = blocking.end ?? blocking.endTime;
      const blockEnd = rawBlockEnd ? hhmmToMinutes(rawBlockEnd) : DAY_END_MIN;
      const overlapsBlock = overlaps(start, end, blockStart, blockEnd);
      if (overlapsBlock) return true;
    }
    return false;
  }

  private inBusinessHours(slot: Slot): boolean {
    const hasBusinessRule = this.businessHours.length > 0;
    if (!hasBusinessRule) return true; // sem regra = sempre aberto
    const dayOfWeek = jsDayOfWeek(slot.date);
    const { start, end, wholeDay } = slotMinutes(slot);
    for (const businessHour of this.businessHours) {
      const appliesToWeekday = businessHour.daysOfWeek.includes(dayOfWeek);
      const beforeRuleValidity = businessHour.start !== undefined && slot.date < businessHour.start;
      const afterRuleValidity = businessHour.end !== undefined && slot.date > businessHour.end;
      const ruleApplies = appliesToWeekday && !beforeRuleValidity && !afterRuleValidity;
      if (!ruleApplies) continue;
      if (wholeDay) return true; // há expediente nesse dia
      const businessStart = hhmmToMinutes(businessHour.startTime);
      const businessEnd = hhmmToMinutes(businessHour.endTime);
      const withinBusinessWindow = start >= businessStart && end <= businessEnd;
      if (withinBusinessWindow) return true;
    }
    return false;
  }

  private inAllowed(slot: Slot): boolean {
    const hasAllowedRule = this.allowedRanges.length > 0;
    if (!hasAllowedRule) return true; // sem restrição
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

  /** Avalia um slot, retornando validade + motivo. */
  evaluate(slot: Slot): SlotEvaluation {
    if (this.isBlocked(slot)) return { valid: false, reason: 'blocked' };
    if (!this.inBusinessHours(slot)) return { valid: false, reason: 'outside-business-hours' };
    if (!this.inAllowed(slot)) return { valid: false, reason: 'outside-allowed' };
    return { valid: true, reason: 'ok' };
  }

  /** Atalho booleano. */
  isValid(slot: Slot): boolean {
    return this.evaluate(slot).valid;
  }
}
