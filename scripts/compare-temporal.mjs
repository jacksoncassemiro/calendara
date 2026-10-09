import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Temporal as ReferenceTemporal } from '@js-temporal/polyfill';
import { Temporal as CandidateTemporal } from 'temporal-polyfill';
import { expandEvent } from '../dist/esm/core/index.js';

assert.equal(globalThis.Temporal, undefined, 'Run this comparison without native Temporal');
const providers = { reference: ReferenceTemporal, candidate: CandidateTemporal };
const timedEvent = ({ start, zone, rule, exDates = [], overrides }) => ({
  id: 'series',
  calendarId: 'calendar',
  title: 'Appointment',
  time: {
    allDay: false,
    start: { dateTime: start, timeZone: zone },
    end: {
      dateTime: ReferenceTemporal.PlainDateTime.from(start).add({ hours: 1 }).toString(),
      timeZone: zone,
    },
  },
  recurrence: { rule, exDates, overrides },
});
const workloads = [
  {
    name: '366 timed occurrences',
    event: timedEvent({
      start: '2024-01-01T09:00:00',
      zone: 'America/New_York',
      rule: 'FREQ=DAILY;COUNT=366',
    }),
  },
  {
    name: 'DST gap COUNT and exclusion',
    event: timedEvent({
      start: '2024-03-09T02:30:00',
      zone: 'America/New_York',
      rule: 'FREQ=DAILY;COUNT=30',
      exDates: ['2024-03-11'],
    }),
  },
  {
    name: 'DST fold UTC UNTIL',
    event: timedEvent({
      start: '2024-11-02T01:30:00',
      zone: 'America/New_York',
      rule: 'FREQ=DAILY;UNTIL=20241103T061500Z',
    }),
  },
  {
    name: 'Monthly ordinal and override',
    event: timedEvent({
      start: '2024-01-01T09:00:00',
      zone: 'Australia/Lord_Howe',
      rule: 'FREQ=MONTHLY;BYDAY=2FR,4FR;COUNT=24',
      overrides: { '2024-01-12T09:00:00': { title: 'Edited' } },
    }),
  },
  {
    name: 'Distant visible month without COUNT',
    event: timedEvent({ start: '2010-01-01T09:00:00', zone: 'Europe/Berlin', rule: 'FREQ=DAILY' }),
    window: { start: '2026-10-01', end: '2026-10-31' },
  },
  {
    name: 'Leap all-day recurrence',
    event: {
      id: 'leap',
      calendarId: 'calendar',
      title: 'Leap',
      time: { allDay: true, start: { date: '2024-02-29' }, end: { date: '2024-03-03' } },
      recurrence: { rule: 'FREQ=YEARLY;COUNT=10' },
    },
  },
];
const sampleCount = 25;
const results = [];
for (const workload of workloads) {
  const run = (temporal) =>
    expandEvent({ temporal, event: workload.event, window: workload.window });
  assert.deepEqual(run(CandidateTemporal), run(ReferenceTemporal), workload.name);
  for (let warmup = 0; warmup < 5; warmup++) {
    run(ReferenceTemporal);
    run(CandidateTemporal);
  }
  const samples = { reference: [], candidate: [] };
  for (let sample = 0; sample < sampleCount; sample++) {
    for (const name of sample % 2 ? ['candidate', 'reference'] : ['reference', 'candidate']) {
      const start = performance.now();
      run(providers[name]);
      samples[name].push(performance.now() - start);
    }
  }
  const durations = Object.fromEntries(
    Object.entries(samples).map(([name, values]) => {
      values.sort((first, second) => first - second);
      return [name, { medianMs: +values[12].toFixed(3), p95Ms: +values[23].toFixed(3) }];
    }),
  );
  results.push({
    name: workload.name,
    occurrences: run(CandidateTemporal).length,
    equivalent: true,
    ...durations,
  });
}
const manifest = (name) => JSON.parse(readFileSync(`node_modules/${name}/package.json`, 'utf8'));
const report = {
  checkedAt: new Date().toISOString(),
  runtime: process.version,
  platform: process.platform,
  versions: {
    reference: manifest('@js-temporal/polyfill').version,
    candidate: manifest('temporal-polyfill').version,
  },
  sampleCount,
  methodology:
    'Same integrated event expansion and output, five warmups, alternating provider order; Node CPU timing, not physical mobile or browser frame latency.',
  results,
};
mkdirSync('experiments/temporal-comparison', { recursive: true });
writeFileSync(
  'experiments/temporal-comparison/results.json',
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report, null, 2));
