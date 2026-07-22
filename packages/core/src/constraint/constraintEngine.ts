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
  const [h, m] = hhmm.split(':');
  return parseInt(h ?? '0', 10) * 60 + parseInt(m ?? '0', 10);
}

/** dia-da-semana JS (0=dom..6=sáb) de uma data 'YYYY-MM-DD' (UTC-safe, sem tz). */
export function jsDayOfWeek(dateISO: string): number {
  const [y, m, d] = dateISO.split('-').map((x) => parseInt(x, 10));
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
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

  constructor(set: ConstraintSet = {}) {
    this.businessHours = set.businessHours ?? [];
    this.allowedRanges = set.allowedRanges ?? [];
    this.blocked = set.blocked ?? [];
  }

  /** Substitui o conjunto de constraints (imutável por chamada). */
  update(set: ConstraintSet): void {
    this.businessHours = set.businessHours ?? [];
    this.allowedRanges = set.allowedRanges ?? [];
    this.blocked = set.blocked ?? [];
  }

  private isBlocked(slot: Slot): boolean {
    const { start, end } = slotMinutes(slot);
    for (const b of this.blocked) {
      if (b.date !== slot.date) continue;
      if (b.scope === 'day') return true;
      // scope 'time'
      const bStart = b.start ? toMinutes(b.start) : 0;
      const bEnd = b.end ?? b.endTime ? toMinutes((b.end ?? b.endTime)!) : 1440;
      if (overlaps(start, end, bStart, bEnd)) return true;
    }
    return false;
  }

  private inBusinessHours(slot: Slot): boolean {
    if (!this.businessHours.length) return true; // sem regra = sempre aberto
    const dow = jsDayOfWeek(slot.date);
    const { start, end, wholeDay } = slotMinutes(slot);
    for (const bh of this.businessHours) {
      if (!bh.daysOfWeek.includes(dow)) continue;
      if (bh.start && slot.date < bh.start) continue;
      if (bh.end && slot.date > bh.end) continue;
      const bhStart = toMinutes(bh.startTime);
      const bhEnd = toMinutes(bh.endTime);
      if (wholeDay) return true; // há expediente nesse dia
      if (start >= bhStart && end <= bhEnd) return true;
    }
    return false;
  }

  private inAllowed(slot: Slot): boolean {
    if (!this.allowedRanges.length) return true; // sem restrição
    const { start, end, wholeDay } = slotMinutes(slot);
    for (const r of this.allowedRanges) {
      if (slot.date < r.start || slot.date > r.end) continue;
      if (wholeDay) return true;
      const rStart = r.startTime ? toMinutes(r.startTime) : 0;
      const rEnd = r.endTime ? toMinutes(r.endTime) : 1440;
      if (start >= rStart && end <= rEnd) return true;
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
