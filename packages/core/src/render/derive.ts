/**
 * Derivações puras do render: expandir recorrência no range visível, projetar cada ocorrência
 * em minutos-do-dia (na timezone de exibição) e derivar a camada de fundo (horário comercial +
 * bloqueios) a partir do ConstraintSet. Nada de DOM/Preact aqui.
 */
import type { TemporalLike } from '../date/temporal.js';
import type { CalendarEvent, EventOccurrence } from '../types/event.js';
import type { EventDateTime } from '../types/datetime.js';
import type { ConstraintSet } from '../types/constraint.js';
import { expandEvent } from '../recurrence/recurrenceSet.js';
import { jsDayOfWeek } from '../constraint/constraintEngine.js';
import type { GeoInput } from '../geometry/geometry.js';

type PlainDate = InstanceType<TemporalLike['PlainDate']>;

/** Segmento vertical em minutos-do-dia. */
export interface Segment {
  startMin: number;
  endMin: number;
}

/** Ocorrência timed já projetada em minutos-do-dia de exibição. */
export interface TimedPlacement extends GeoInput {
  occurrence: EventOccurrence;
}

/** Tudo que uma coluna de dia precisa desenhar. */
export interface DayData {
  date: PlainDate;
  dateISO: string;
  timed: TimedPlacement[];
  allDay: EventOccurrence[];
  /** Fora do horário comercial (sombreado). */
  nonBusiness: Segment[];
  /** Bloqueios (dia inteiro ou faixa). */
  blocked: Segment[];
}

function occKey(occ: EventOccurrence): string {
  return `${occ.masterId}@${occ.originalStart}`;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':');
  return parseInt(h ?? '0', 10) * 60 + parseInt(m ?? '0', 10);
}

/** Expande todos os eventos no range [startISO, endISO] (datas inclusivas). Memoizável por chamador. */
export function expandRange(
  T: TemporalLike,
  events: readonly CalendarEvent[],
  startISO: string,
  endISO: string,
): EventOccurrence[] {
  const out: EventOccurrence[] = [];
  for (const ev of events) {
    for (const occ of expandEvent(T, ev, { start: startISO, end: endISO })) {
      out.push(occ);
    }
  }
  return out;
}

/** Converte um extremo timed para ZonedDateTime na timezone de exibição. */
function toDisplayZdt(
  T: TemporalLike,
  edt: EventDateTime,
  displayTz: string,
): InstanceType<TemporalLike['ZonedDateTime']> {
  const tz = edt.timeZone ?? displayTz;
  const pdt = T.PlainDateTime.from(edt.dateTime!);
  return pdt.toZonedDateTime(tz).withTimeZone(displayTz);
}

/**
 * Distribui ocorrências pelos dias visíveis, projetando os timed em minutos-do-dia de exibição.
 * Eventos que cruzam a meia-noite são ancorados no dia de início e recortados (Fase 2).
 */
export function buildDays(
  T: TemporalLike,
  days: readonly PlainDate[],
  occurrences: readonly EventOccurrence[],
  constraints: ConstraintSet,
  grid: { startHour: number; endHour: number },
  displayTz: string,
): DayData[] {
  const gridStart = grid.startHour * 60;
  const gridEnd = grid.endHour * 60;

  const byDay = new Map<string, DayData>();
  for (const d of days) {
    const iso = d.toString();
    byDay.set(iso, {
      date: d,
      dateISO: iso,
      timed: [],
      allDay: [],
      nonBusiness: deriveNonBusiness(constraints, iso, gridStart, gridEnd),
      blocked: deriveBlocked(constraints, iso, gridStart, gridEnd),
    });
  }

  for (const occ of occurrences) {
    const t = occ.event.time;
    if (t.allDay) {
      const iso = (t.start.date ?? '').slice(0, 10);
      byDay.get(iso)?.allDay.push(occ);
      continue;
    }
    const startZdt = toDisplayZdt(T, t.start, displayTz);
    const endZdt = toDisplayZdt(T, t.end, displayTz);
    const dayISO = startZdt.toPlainDate().toString();
    const col = byDay.get(dayISO);
    if (!col) continue; // fora dos dias visíveis
    const startMin = startZdt.hour * 60 + startZdt.minute;
    const sameDay = endZdt.toPlainDate().toString() === dayISO;
    const endMin = sameDay ? endZdt.hour * 60 + endZdt.minute : 1440;
    col.timed.push({
      id: occKey(occ),
      startMin,
      endMin: Math.max(endMin, startMin),
      occurrence: occ,
    });
  }

  return days.map((d) => byDay.get(d.toString())!);
}

/** Sombreado "fora do expediente" = grid − janelas de horário comercial do dia. */
function deriveNonBusiness(
  constraints: ConstraintSet,
  dateISO: string,
  gridStart: number,
  gridEnd: number,
): Segment[] {
  const bh = constraints.businessHours ?? [];
  if (bh.length === 0) return []; // sem regra = sempre aberto (nada sombreado)
  const dow = jsDayOfWeek(dateISO);
  const open: Segment[] = [];
  for (const rule of bh) {
    if (!rule.daysOfWeek.includes(dow)) continue;
    if (rule.start && dateISO < rule.start) continue;
    if (rule.end && dateISO > rule.end) continue;
    const s = Math.max(toMinutes(rule.startTime), gridStart);
    const e = Math.min(toMinutes(rule.endTime), gridEnd);
    if (e > s) open.push({ startMin: s, endMin: e });
  }
  return complement(mergeSegments(open), gridStart, gridEnd);
}

/** Bloqueios do dia (precedência total): dia inteiro → grid; faixa → intervalo recortado. */
function deriveBlocked(
  constraints: ConstraintSet,
  dateISO: string,
  gridStart: number,
  gridEnd: number,
): Segment[] {
  const out: Segment[] = [];
  for (const b of constraints.blocked ?? []) {
    if (b.date !== dateISO) continue;
    if (b.scope === 'day') return [{ startMin: gridStart, endMin: gridEnd }];
    const s = Math.max(b.start ? toMinutes(b.start) : gridStart, gridStart);
    const raw = b.end ?? b.endTime;
    const e = Math.min(raw ? toMinutes(raw) : gridEnd, gridEnd);
    if (e > s) out.push({ startMin: s, endMin: e });
  }
  return mergeSegments(out);
}

/** Une segmentos sobrepostos/adjacentes. */
function mergeSegments(segs: Segment[]): Segment[] {
  if (segs.length <= 1) return segs.slice();
  const sorted = [...segs].sort((a, b) => a.startMin - b.startMin);
  const merged: Segment[] = [];
  for (const s of sorted) {
    const last = merged[merged.length - 1];
    if (last && s.startMin <= last.endMin) {
      last.endMin = Math.max(last.endMin, s.endMin);
    } else {
      merged.push({ ...s });
    }
  }
  return merged;
}

/** Complemento de `segs` (já mesclados) dentro de [lo,hi). */
function complement(segs: Segment[], lo: number, hi: number): Segment[] {
  const out: Segment[] = [];
  let cursor = lo;
  for (const s of segs) {
    if (s.startMin > cursor) out.push({ startMin: cursor, endMin: s.startMin });
    cursor = Math.max(cursor, s.endMin);
  }
  if (cursor < hi) out.push({ startMin: cursor, endMin: hi });
  return out;
}
