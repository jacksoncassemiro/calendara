import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import ICAL from 'ical.js';
import rrule from 'rrule';
import { RRuleTemporal } from 'rrule-temporal';
import { Temporal } from '@js-temporal/polyfill';
import { parseRRule, serializeRRule, expandRuleAll } from '../dist/esm/core/index.js';
import { expandTemporalRule } from '../dist/esm/core/recurrence/engine.js';
import { iterateCivilDates } from '../dist/esm/core/recurrence/civilIterator.js';

// Compare boundaries and combined recurrence filters. / PT: Compara limites e filtros combinados de recorrência.
let checks = 0;
for (const freq of ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'])
  for (const interval of [1, 2, 3])
    for (const filter of [
      '',
      ';BYDAY=MO,FR',
      ';BYMONTHDAY=1,-1',
      ';BYMONTH=2,7',
      ';BYDAY=MO,FR;BYSETPOS=-1',
    ])
      for (const count of ['', ';COUNT=8'])
        for (const windowStart of ['2024-01-01', '2024-02-28', '2025-06-10', '2026-12-31'])
          for (const dtStart of ['2024-01-03', '2024-02-29', '2024-12-31']) {
            const model = parseRRule(`FREQ=${freq};INTERVAL=${interval}${filter}${count}`);
            const start = Temporal.PlainDate.from(dtStart);
            const options = {
              windowStart: Temporal.PlainDate.from(windowStart),
              windowEnd: Temporal.PlainDate.from('2026-12-31'),
            };
            const reference = [
              ...expandTemporalRule({
                temporal: Temporal,
                model,
                dtstart: start,
                exDates: new Set(),
                options,
              }),
            ].map((x) => x.toString());
            assert.deepEqual(
              expandRuleAll({
                temporal: Temporal,
                model,
                dtstart: start,
                exDates: new Set(),
                maxResults: 10000,
                options,
              }).map((x) => x.toString()),
              reference,
              serializeRRule(model),
            );
            checks++;
          }
const cases = [
  ['daily distant', '2010-01-01', 'FREQ=DAILY;UNTIL=20261031', '2026-10-01', '2026-10-31'],
  [
    'weekly',
    '2024-01-01',
    'FREQ=WEEKLY;INTERVAL=2;BYDAY=SU,MO,WE;WKST=SU;COUNT=24',
    '2024-01-01',
    '2025-12-31',
  ],
  [
    'monthly ordinals',
    '2024-01-01',
    'FREQ=MONTHLY;BYDAY=2FR,4FR;COUNT=24',
    '2024-01-01',
    '2025-12-31',
  ],
  ['yearly leap', '2024-02-29', 'FREQ=YEARLY;COUNT=6', '2024-01-01', '2045-12-31'],
];
const results = [];
for (const [name, start, rule, from, to] of cases) {
  const model = parseRRule(rule),
    dt = Temporal.PlainDate.from(start),
    options = {
      windowStart: Temporal.PlainDate.from(from),
      windowEnd: Temporal.PlainDate.from(to),
    };
  const rr = new rrule.RRule(
    { ...rrule.RRule.parseString(rule), dtstart: new Date(`${start}T00:00:00Z`) },
    true,
  );
  const rt = new RRuleTemporal({
    rruleString: `DTSTART;VALUE=DATE:${start.replaceAll('-', '')}\nRRULE:${rule}`,
    cache: false,
  });
  const methods = {
    temporalReference: () =>
      [
        ...expandTemporalRule({
          temporal: Temporal,
          model,
          dtstart: dt,
          exDates: new Set(),
          options,
        }),
      ].map((x) => x.toString()),
    civil: () => [
      ...iterateCivilDates({ model, startDateISO: start, window: { start: from, end: to } }),
    ],
    production: () =>
      expandRuleAll({
        temporal: Temporal,
        model,
        dtstart: dt,
        exDates: new Set(),
        maxResults: 10000,
        options,
      }).map((x) => x.toString()),
    rrule: () =>
      rr
        .between(new Date(`${from}T00:00:00Z`), new Date(`${to}T00:00:00Z`), true)
        .map((x) => x.toISOString().slice(0, 10)),
    ical: () => {
      const iterator = ICAL.Recur.fromString(rule).iterator(ICAL.Time.fromString(start));
      const out = [];
      let x;
      while ((x = iterator.next())) {
        const iso = x.toString().slice(0, 10);
        if (iso > to) break;
        if (iso >= from) out.push(iso);
      }
      return out;
    },
    rruleTemporal: () =>
      rt
        .between(new Date(`${from}T00:00:00Z`), new Date(`${to}T00:00:00Z`), true)
        .map((x) => x.toPlainDate().toString()),
  };
  const expected = methods.temporalReference(),
    timings = {};
  for (const [library, run] of Object.entries(methods)) {
    const actual = run();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      timings[library] = { comparable: false, expected, actual };
      continue;
    }
    for (let i = 0; i < 2; i++) run();
    const samples = [];
    for (let i = 0; i < 25; i++) {
      const begin = performance.now();
      run();
      samples.push(performance.now() - begin);
    }
    samples.sort((a, b) => a - b);
    timings[library] = {
      mean: +(samples.reduce((a, b) => a + b, 0) / samples.length).toFixed(3),
      median: +samples[12].toFixed(3),
      p95: +samples[23].toFixed(3),
    };
  }
  results.push({ name, occurrences: expected.length, milliseconds: timings });
}
const report = {
  checkedAt: new Date().toISOString(),
  node: process.version,
  differentialChecks: checks,
  iterations: 25,
  cache: false,
  results,
};
writeFileSync(
  'experiments/civil-recurrence/comparison.json',
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report, null, 2));
