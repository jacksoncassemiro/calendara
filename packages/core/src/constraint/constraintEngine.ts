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

/** Slot a avaliar: uma data e (opcional) faixa de horário em minutos. */
export interface Slot {
  /** 'YYYY-MM-DD'. */
  date: string;
  /** minuto do dia (0..1439). Ausente = dia inteiro. */
  startMin?: number;
  /** minuto do dia final (exclusivo). Ausente = usa startMin. */
  endMin?: number;
}

function toMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':');
  return parseInt(hours ?? '0', 10) * 60 + parseInt(minutes ?? '0', 10);
}

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
  if (slot.startMin === undefined) return { start: 0, end: 1440, wholeDay: true };
  const start = slot.startMin;
  const end = slot.endMin ?? slot.startMin;
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
      if (blocking.date !== slot.date) continue;
      if (blocking.scope === 'day') return true;
      // scope 'time'
      const blockStart = blocking.start ? toMinutes(blocking.start) : 0;
      const blockEnd =
        blocking.end ?? blocking.endTime ? toMinutes((blocking.end ?? blocking.endTime)!) : 1440;
      if (overlaps(start, end, blockStart, blockEnd)) return true;
    }
    return false;
  }

  private inBusinessHours(slot: Slot): boolean {
    if (!this.businessHours.length) return true; // sem regra = sempre aberto
    const dayOfWeek = jsDayOfWeek(slot.date);
    const { start, end, wholeDay } = slotMinutes(slot);
    for (const businessHour of this.businessHours) {
      if (!businessHour.daysOfWeek.includes(dayOfWeek)) continue;
      if (businessHour.start && slot.date < businessHour.start) continue;
      if (businessHour.end && slot.date > businessHour.end) continue;
      const businessStart = toMinutes(businessHour.startTime);
      const businessEnd = toMinutes(businessHour.endTime);
      if (wholeDay) return true; // há expediente nesse dia
      if (start >= businessStart && end <= businessEnd) return true;
    }
    return false;
  }

  private inAllowed(slot: Slot): boolean {
    if (!this.allowedRanges.length) return true; // sem restrição
    const { start, end, wholeDay } = slotMinutes(slot);
    for (const range of this.allowedRanges) {
      if (slot.date < range.start || slot.date > range.end) continue;
      if (wholeDay) return true;
      const rangeStart = range.startTime ? toMinutes(range.startTime) : 0;
      const rangeEnd = range.endTime ? toMinutes(range.endTime) : 1440;
      if (start >= rangeStart && end <= rangeEnd) return true;
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
