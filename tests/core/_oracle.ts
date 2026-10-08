/** Test-only rrule.js oracle and calendar recurrence runner. */
import rrulePackage from 'rrule';
import type { TemporalLike } from '../../src/core/date/temporal.js';
import { parseRRule } from '../../src/core/recurrence/parser.js';
import { expandRuleAll } from '../../src/core/recurrence/engine.js';

const { RRule, RRuleSet } = rrulePackage;

const formatUTCDateISO = (date: Date): string =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
    date.getUTCDate(),
  ).padStart(2, '0')}`;

export function expandRRuleOracle(
  startDateISO: string,
  recurrenceText: string,
  occurrenceLimit = 60,
): string[] {
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

/** Expand RRULE and optional EXDATE into YYYY-MM-DD dates. */
export function expandCalendarRule(
  temporal: TemporalLike,
  startDateISO: string,
  recurrenceText: string,
  occurrenceLimit = 60,
): string[] {
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
  return expandRuleAll(temporal, recurrenceRule, startDate, excludedDateISOs, occurrenceLimit).map(
    (occurrenceDate) => occurrenceDate.toString(),
  );
}
