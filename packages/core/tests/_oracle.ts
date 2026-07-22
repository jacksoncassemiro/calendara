/**
 * Helpers de teste: oráculo rrule.js + runner do nosso motor.
 * rrule fica FORA do runtime da lib — só aqui, como oráculo (ADR-003).
 */
import rrulePkg from 'rrule';
import type { TemporalLike } from '../src/date/temporal.js';
import { parseRRule } from '../src/recurrence/parser.js';
import { expandRuleAll } from '../src/recurrence/engine.js';

const { RRule, RRuleSet } = rrulePkg;

const fmt = (d: Date): string =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;

export function oracle(dtISO: string, ruleStr: string, limit = 60): string[] {
  const [y, m, d] = dtISO.split('-').map(Number);
  const rline = ruleStr
    .split('\n')
    .find((l) => l.startsWith('RRULE:'))!
    .replace('RRULE:', '');
  const opts = RRule.parseString(rline);
  opts.dtstart = new Date(Date.UTC(y!, m! - 1, d!));
  const rule = new RRule(opts);
  const exline = ruleStr.split('\n').find((l) => l.startsWith('EXDATE:'));
  if (!exline) return rule.all((_x, i) => i < limit).map(fmt);
  const set = new RRuleSet();
  set.rrule(rule);
  exline
    .replace('EXDATE:', '')
    .split(',')
    .forEach((v) =>
      set.exdate(
        new Date(Date.UTC(+v.substring(0, 4), +v.substring(4, 6) - 1, +v.substring(6, 8))),
      ),
    );
  return set.all((_x, i) => i < limit).map(fmt);
}

/** Roda o NOSSO motor sobre uma string RRULE (+ EXDATE opcional). Retorna 'YYYY-MM-DD'. */
export function ours(T: TemporalLike, dtISO: string, ruleStr: string, limit = 60): string[] {
  const model = parseRRule(ruleStr);
  const exline = ruleStr.split('\n').find((l) => l.startsWith('EXDATE:'));
  const exSet = new Set<string>();
  if (exline) {
    exline
      .replace('EXDATE:', '')
      .split(',')
      .forEach((v) =>
        exSet.add(`${v.substring(0, 4)}-${v.substring(4, 6)}-${v.substring(6, 8)}`),
      );
  }
  const dtstart = T.PlainDate.from(dtISO);
  return expandRuleAll(T, model, dtstart, exSet, limit).map((d) => d.toString());
}
