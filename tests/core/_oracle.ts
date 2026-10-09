import rrulePackage from 'rrule';
import type { TemporalLike } from '../../src/core/date/temporal.js';
import { parseRRule } from '../../src/core/recurrence/parser.js';
import { expandRuleAll } from '../../src/core/recurrence/engine.js';

const { RRule, RRuleSet } = rrulePackage;

const formatUTCDateISO = (date: Date): string =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
    date.getUTCDate(),
  ).padStart(2, '0')}`;

/** Expand with independent rrule.js semantics. / PT: Expande com a semântica independente do rrule.js. */
export function expandRRuleOracle({
  startDateISO,
  recurrenceText,
  occurrenceLimit = 60,
}: {
  /** First recurrence date, YYYY-MM-DD. / PT: Primeira data recorrente, YYYY-MM-DD. */
  startDateISO: string;
  /** RRULE with optional EXDATE lines. / PT: RRULE com linhas EXDATE opcionais. */
  recurrenceText: string;
  /** Expansion limit; defaults to 60. / PT: Limite da expansão; padrão 60. */
  occurrenceLimit?: number;
}): string[] {
  const [startYear, startMonth, startDay] = startDateISO.split('-').map(Number);
  const recurrenceLine = recurrenceText
    .split('\n')
    .find((line) => line.startsWith('RRULE:'))!
    .replace('RRULE:', '');
  const ruleOptions = RRule.parseString(recurrenceLine);
  ruleOptions.dtstart = new Date(Date.UTC(startYear!, startMonth! - 1, startDay!));
  const referenceRule = new RRule(ruleOptions);
  const excludedDatesLine = recurrenceText.split('\n').find((line) => line.startsWith('EXDATE:'));
  if (!excludedDatesLine) {
    return referenceRule
      .all((_occurrenceDate, occurrenceIndex) => occurrenceIndex < occurrenceLimit)
      .map(formatUTCDateISO);
  }
  const referenceSet = new RRuleSet();
  referenceSet.rrule(referenceRule);
  excludedDatesLine
    .replace('EXDATE:', '')
    .split(',')
    .forEach((compactDate) =>
      referenceSet.exdate(
        new Date(
          Date.UTC(
            Number(compactDate.substring(0, 4)),
            Number(compactDate.substring(4, 6)) - 1,
            Number(compactDate.substring(6, 8)),
          ),
        ),
      ),
    );
  return referenceSet
    .all((_occurrenceDate, occurrenceIndex) => occurrenceIndex < occurrenceLimit)
    .map(formatUTCDateISO);
}

/** Expand through the calendar engine for oracle comparison. / PT: Expande pelo motor para comparar com o oráculo. */
export function expandCalendarRule({
  temporal,
  startDateISO,
  recurrenceText,
  occurrenceLimit = 60,
}: {
  /** Temporal implementation used by the calendar. / PT: Implementação Temporal usada pelo calendário. */
  temporal: TemporalLike;
  /** First recurrence date, YYYY-MM-DD. / PT: Primeira data recorrente, YYYY-MM-DD. */
  startDateISO: string;
  /** RRULE with optional EXDATE lines. / PT: RRULE com linhas EXDATE opcionais. */
  recurrenceText: string;
  /** Expansion limit; defaults to 60. / PT: Limite da expansão; padrão 60. */
  occurrenceLimit?: number;
}): string[] {
  const recurrenceRule = parseRRule(recurrenceText);
  const excludedDatesLine = recurrenceText.split('\n').find((line) => line.startsWith('EXDATE:'));
  const excludedDateISOs = new Set<string>();
  if (excludedDatesLine) {
    excludedDatesLine
      .replace('EXDATE:', '')
      .split(',')
      .forEach((compactDate) =>
        excludedDateISOs.add(
          `${compactDate.substring(0, 4)}-${compactDate.substring(4, 6)}-${compactDate.substring(6, 8)}`,
        ),
      );
  }
  const startDate = temporal.PlainDate.from(startDateISO);
  return expandRuleAll({
    temporal,
    model: recurrenceRule,
    dtstart: startDate,
    exDates: excludedDateISOs,
    maxResults: occurrenceLimit,
  }).map((occurrenceDate) => occurrenceDate.toString());
}
