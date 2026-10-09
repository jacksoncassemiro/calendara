import { ConstraintEngine } from '../constraint/constraintEngine.js';
import { hhmmToMinutes } from '../date/time.js';
import type { BusinessHours, ConstraintSet, DateRange } from '../types/constraint.js';
import type { CalendarResource } from '../types/resource.js';
import type { Segment } from './derive.js';

const FIRST_DATE = '0001-01-01';
const LAST_DATE = '9999-12-31';

function intersectBusinessHours(first: BusinessHours[], second: BusinessHours[]): BusinessHours[] {
  if (first.length === 0) return second;
  if (second.length === 0) return first;
  const intersections: BusinessHours[] = [];
  for (const firstRule of first) {
    for (const secondRule of second) {
      const daysOfWeek = firstRule.daysOfWeek.filter((day) => secondRule.daysOfWeek.includes(day));
      const startTime =
        firstRule.startTime > secondRule.startTime ? firstRule.startTime : secondRule.startTime;
      const endTime =
        firstRule.endTime < secondRule.endTime ? firstRule.endTime : secondRule.endTime;
      const start = [firstRule.start ?? FIRST_DATE, secondRule.start ?? FIRST_DATE].sort()[1]!;
      const end = [firstRule.end ?? LAST_DATE, secondRule.end ?? LAST_DATE].sort()[0]!;
      if (daysOfWeek.length > 0 && startTime < endTime && start <= end) {
        intersections.push({ daysOfWeek, startTime, endTime, start, end });
      }
    }
  }
  return intersections.length > 0
    ? intersections
    : [{ daysOfWeek: [], startTime: '00:00', endTime: '24:00' }];
}

function intersectAllowedRanges(first: DateRange[], second: DateRange[]): DateRange[] {
  if (first.length === 0) return second;
  if (second.length === 0) return first;
  const intersections: DateRange[] = [];
  for (const firstRange of first) {
    for (const secondRange of second) {
      const start = firstRange.start > secondRange.start ? firstRange.start : secondRange.start;
      const end = firstRange.end < secondRange.end ? firstRange.end : secondRange.end;
      const startTime = [
        firstRange.startTime ?? '00:00',
        secondRange.startTime ?? '00:00',
      ].sort()[1]!;
      const endTime = [firstRange.endTime ?? '24:00', secondRange.endTime ?? '24:00'].sort()[0]!;
      if (start <= end && startTime < endTime)
        intersections.push({ start, end, startTime, endTime });
    }
  }
  return intersections.length > 0 ? intersections : [{ start: LAST_DATE, end: FIRST_DATE }];
}

/** Global and resource-local availability inputs.
 * @remarks Português: Entradas de disponibilidade geral e local do recurso.
 */
export interface ResourceConstraintSetInput {
  /** Resource whose local rules are evaluated.
   * @remarks Português: Recurso cujas regras locais serão avaliadas.
   */
  resource: CalendarResource;
  /** Global availability retained for this resource.
   * @remarks Português: Disponibilidade geral preservada para este recurso.
   */
  global: ConstraintSet;
}

/** Combine global and local availability; local rules never relax global restrictions.
 * @remarks Português: Combina disponibilidade geral e local; regras locais não relaxam restrições gerais.
 */
export function resourceConstraintSet({
  resource,
  global,
}: ResourceConstraintSetInput): ConstraintSet {
  const local = resource.constraints ?? {};
  const businessHours = intersectBusinessHours(
    intersectBusinessHours(global.businessHours ?? [], resource.businessHours ?? []),
    local.businessHours ?? [],
  );
  const allowedRanges = intersectAllowedRanges(
    global.allowedRanges ?? [],
    local.allowedRanges ?? [],
  );
  const blocked = [...(global.blocked ?? []), ...(local.blocked ?? [])];
  const result: ConstraintSet = {};
  if (businessHours.length > 0) result.businessHours = businessHours;
  if (allowedRanges.length > 0) result.allowedRanges = allowedRanges;
  if (blocked.length > 0) result.blocked = blocked;
  return result;
}

/** Named inputs for resourceSlotBands.
 * @remarks Português: Entradas nomeadas de resourceSlotBands.
 */
export interface ResourceSlotBandsInput {
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

/** Derive unavailable background intervals using the same rules as placement validation.
 * @remarks Português: Deriva faixas de fundo indisponíveis com as mesmas regras da validação de posicionamento.
 */

export function resourceSlotBands({
  constraints,
  date,
  startMin,
  endMin,
}: ResourceSlotBandsInput): Segment[] {
  const boundaries = new Set([startMin, endMin]);
  const addBoundary = (time: string | undefined): void => {
    if (time === undefined) return;
    const minute = hhmmToMinutes(time);
    if (minute > startMin && minute < endMin) boundaries.add(minute);
  };
  for (const rule of [
    ...(constraints.businessHours ?? []),
    ...(constraints.allowedRanges ?? []),
    ...(constraints.blocked ?? []),
  ]) {
    addBoundary(rule.startTime);
    addBoundary(rule.endTime);
  }
  const ordered = [...boundaries].sort((first, second) => first - second);
  const engine = new ConstraintEngine(constraints);
  const segments: Segment[] = [];
  for (let index = 1; index < ordered.length; index++) {
    const interval = { startMin: ordered[index - 1]!, endMin: ordered[index]! };
    const evaluation = engine.evaluate({ date, ...interval });
    if (evaluation.valid || evaluation.reason === 'blocked') continue;
    const previous = segments[segments.length - 1];
    if (previous?.endMin === interval.startMin) previous.endMin = interval.endMin;
    else segments.push(interval);
  }
  return segments;
}
