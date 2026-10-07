import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { Temporal } from '@js-temporal/polyfill';
import rrulePkg from 'rrule';
import { expandEvent, expandRuleAll, parseRRule } from '../../dist/esm/core/index.js';
import { expandCivilEvent, expandCivilRule } from './engine.mjs';

const { RRule, RRuleSet } = rrulePkg;
const source = await readFile(new URL('../../tests/core/scenarios.ts', import.meta.url), 'utf8');
const scenarios = [...source.matchAll(/\['([^']+)', '([^']+)', '([^']+)'\]/g)].map((match) => [match[1], match[2], match[3].replaceAll('\\n', '\n')]);
function date(iso) { const value = new Date(0); const [year, month, day] = iso.split('-').map(Number); value.setUTCFullYear(year, month - 1, day); return value; }
for (const [name, start, rule] of scenarios) {
  const model = parseRRule(rule);
  const exdates = (rule.split('\n').find((line) => line.startsWith('EXDATE:'))?.slice(7).split(',') ?? [])
    .map((value) => `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`);
  const options = { ...RRule.parseString(rule.split('\n')[0].replace('RRULE:', '')), dtstart: date(start) };
  const set = new RRuleSet();
  set.rrule(new RRule(options));
  for (const excluded of exdates) set.exdate(date(excluded));
  const oracle = set.all((_value, index) => index < 60).map((value) => value.toISOString().slice(0, 10));
  const temporal = expandRuleAll(Temporal, model, Temporal.PlainDate.from(start), new Set(exdates), 60).map(String);
  const civil = expandCivilRule(model, start).filter((value) => !exdates.includes(value)).slice(0, 60);
  assert.deepEqual(civil, temporal, `Civil vs Temporal: ${name}`);
  assert.deepEqual(civil, oracle, `Civil vs rrule: ${name}`);
}

const base = { id: 'event', calendarId: 'calendar', title: 'Appointment', time: { allDay: false,
  start: { dateTime: '2024-03-08T09:00:00', timeZone: 'America/New_York' },
  end: { dateTime: '2024-03-08T10:00:00', timeZone: 'America/New_York' } } };
const integration = [
  ['daily DST + COUNT', { rule: 'FREQ=DAILY;COUNT=6' }, {}],
  ['exact EXDATE UTC + custom RDATE', { rule: 'FREQ=DAILY;COUNT=5', exDates: ['2024-03-09T14:00:00Z'], rDates: ['2024-03-10T11:00:00'] }, {}],
  ['EXDATE date whole day', { rule: 'FREQ=DAILY;COUNT=5', exDates: ['2024-03-10'], rDates: ['2024-03-10T11:00:00'] }, {}],
  ['override title keeps occurrence time', { rule: 'FREQ=DAILY;COUNT=5', overrides: { '2024-03-11T09:00:00': { title: 'Edited' } } }, {}],
  ['cancel occurrence', { rule: 'FREQ=DAILY;COUNT=5', overrides: { '2024-03-10': { cancelled: true } } }, {}],
  ['UNTIL UTC before final start', { rule: 'FREQ=DAILY;UNTIL=20240310T125959Z' }, {}],
  ['UNTIL UTC inclusive DST offset', { rule: 'FREQ=DAILY;UNTIL=20240310T130000Z' }, {}],
  ['weekly constrained window', { rule: 'FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=12' }, { start: '2024-03-11', end: '2024-03-20' }],
  ['monthly multiordinal + EXDATE', { rule: 'FREQ=MONTHLY;BYDAY=2FR,4FR;COUNT=6', exDates: ['2024-03-22'] }, {}],
  ['yearly ordinals + RDATE', { rule: 'FREQ=YEARLY;BYDAY=1MO,-1FR;COUNT=4', rDates: ['2024-03-10T13:00:00Z'] }, {}],
];
const movedTime = { allDay: false, start: { dateTime: '2024-04-15T09:00:00', timeZone: 'America/New_York' }, end: { dateTime: '2024-04-15T10:00:00', timeZone: 'America/New_York' } };
integration.push(['moved override originally outside window', { rule: 'FREQ=DAILY;COUNT=5', overrides: { '2024-03-09T09:00:00': { time: movedTime } } }, { start: '2024-04-15', end: '2024-04-15' }]);
integration.push(['moved invalid/excluded occurrence', { rule: 'FREQ=DAILY;COUNT=5', exDates: ['2024-03-09'], overrides: { '2024-03-09T09:00:00': { time: movedTime }, '2024-03-20T09:00:00': { time: movedTime } } }, { start: '2024-04-15', end: '2024-04-15' }]);
const digest = (values) => values.map(({ event, originalStart, isMaster, masterId }) => ({ time: event.time, title: event.title, originalStart, isMaster, masterId }));
for (const [name, recurrence, window] of integration) {
  const event = { ...base, recurrence };
  assert.deepEqual(digest(expandCivilEvent(event, window)), digest(expandEvent(Temporal, event, window)), name);
}
const allDay = { ...base, time: { allDay: true, start: { date: '2024-02-28' }, end: { date: '2024-03-02' } }, recurrence: { rule: 'FREQ=DAILY;COUNT=4', exDates: ['2024-02-29'] } };
assert.deepEqual(digest(expandCivilEvent(allDay)), digest(expandEvent(Temporal, allDay)), 'multiday all-day leap span');

// Explicit challenge probes: the experiment cannot replace production's new
// instant-aware DST policy. Record divergences instead of claiming total parity.
const gapEvent = { ...base, time: { allDay: false,
  start: { dateTime: '2024-03-09T02:30:00', timeZone: 'America/New_York' },
  end: { dateTime: '2024-03-09T03:30:00', timeZone: 'America/New_York' } }, recurrence: { rule: 'FREQ=DAILY;COUNT=3' } };
const foldBase = { ...base, time: { allDay: false,
  start: { dateTime: '2024-11-02T01:30:00', timeZone: 'America/New_York' },
  end: { dateTime: '2024-11-02T02:30:00', timeZone: 'America/New_York' } } };
const dstDivergences = [];
for (const [name, event] of [
  ['gap start does not consume COUNT', gapEvent],
  ['fold UTC UNTIL compares actual instant', { ...foldBase, recurrence: { rule: 'FREQ=DAILY;UNTIL=20241103T061500Z' } }],
  ['fold EXDATE second instant retains first instant', { ...foldBase, recurrence: { rule: 'FREQ=DAILY;COUNT=3', exDates: ['2024-11-03T06:30:00Z'] } }],
]) {
  const production = digest(expandEvent(Temporal, event));
  const experiment = digest(expandCivilEvent(event));
  assert.notDeepEqual(production, experiment, `Known DST limitation must remain visible: ${name}`);
  dstDivergences.push({ name, productionStarts: production.map(item => item.originalStart), experimentalStarts: experiment.map(item => item.originalStart) });
}

// End-to-end identical recurrence+exception inputs and full occurrence outputs.
const benchCases = [
  ['daily DST exceptions', { ...base, recurrence: { rule: 'FREQ=DAILY;COUNT=40', exDates: ['2024-03-09T14:00:00Z'], rDates: ['2024-03-10T11:00:00'], overrides: { '2024-03-11T09:00:00': { title: 'Edited' } } } }, {}],
  ['monthly multiordinal', { ...base, recurrence: { rule: 'FREQ=MONTHLY;BYDAY=2FR,4FR;COUNT=24' } }, {}],
  ['yearly leap', { ...allDay, recurrence: { rule: 'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29;COUNT=6' } }, {}],
  ['daily distant visible month', { ...base, time: { ...base.time, start: { ...base.time.start, dateTime: '2010-01-01T09:00:00' }, end: { ...base.time.end, dateTime: '2010-01-01T10:00:00' } }, recurrence: { rule: 'FREQ=DAILY' } }, { start: '2026-10-01', end: '2026-10-31' }],
];
const iterations = Number(process.argv[2] ?? 10);
assert(Number.isInteger(iterations) && iterations > 0);
const metrics = [];
function measure(run) { for (let warm = 0; warm < 2; warm++) run(); const start = performance.now(); for (let index = 0; index < iterations; index++) run(); return (performance.now() - start) / iterations; }
for (const [name, event, window] of benchCases) {
  const temporalRun = () => expandEvent(Temporal, event, window);
  const civilRun = () => expandCivilEvent(event, window);
  assert.deepEqual(digest(civilRun()), digest(temporalRun()), name);
  const temporalMs = measure(temporalRun);
  const civilMs = measure(civilRun);
  metrics.push({ name, occurrences: civilRun().length, temporalMs, civilMs, ratio: temporalMs / civilMs });
}
const ruleMetrics = [];
const ruleBenchCases = [
  ['DAILY distant window', '2010-01-01', 'FREQ=DAILY;UNTIL=20261031', { start: '2026-10-01', end: '2026-10-31' }],
  ['WEEKLY interval/WKST', '2024-01-03', 'FREQ=WEEKLY;INTERVAL=2;BYDAY=SU,MO,WE;WKST=SU;COUNT=24', {}],
  ['MONTHLY multiordinal', '2024-03-08', 'FREQ=MONTHLY;BYDAY=2FR,4FR;COUNT=24', {}],
  ['YEARLY leap', '2024-02-28', 'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29;COUNT=6', {}],
];
for (const [name, start, rule, window] of ruleBenchCases) {
  // Models and oracle instance prepared outside timings: benchmark is expansion only.
  const model = parseRRule(rule);
  const plainStart = Temporal.PlainDate.from(start);
  const options = { ...(window.start ? { windowStart: Temporal.PlainDate.from(window.start) } : {}), ...(window.end ? { windowEnd: Temporal.PlainDate.from(window.end) } : {}) };
  const oracle = new RRule({ ...RRule.parseString(rule), dtstart: date(start) }, true); // disable result cache
  const windowStart = window.start ? date(window.start) : null;
  const windowEnd = window.end ? date(window.end) : null;
  const oracleRun = () => (windowEnd ? oracle.between(windowStart ?? date(start), windowEnd, true) : oracle.all()).map((value) => value.toISOString().slice(0, 10));
  const temporalRun = () => expandRuleAll(Temporal, model, plainStart, new Set(), 10000, options).map(String);
  const civilRun = () => expandCivilRule(model, start, window);
  assert.deepEqual(civilRun(), temporalRun(), name);
  assert.deepEqual(civilRun(), oracleRun(), name);
  const temporalMs = measure(temporalRun);
  const civilMs = measure(civilRun);
  const rruleMs = measure(oracleRun);
  ruleMetrics.push({ name, rule, start, window, results: civilRun().length, temporalMs, civilMs, rruleMs, temporalToCivil: temporalMs / civilMs, rruleToCivil: rruleMs / civilMs });
}
const report = { measuredAt: new Date().toISOString(), runtime: process.version, iterations, dateScenarios: scenarios.length, eventIntegrations: integration.length + 1, dstDivergences, metrics, ruleMetrics };
console.log(JSON.stringify(report, null, 2));
await writeFile(new URL('metrics.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
