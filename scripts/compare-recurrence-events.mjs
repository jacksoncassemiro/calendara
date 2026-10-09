// Isolated recurrence integration experiment. / PT: Experimento isolado de integração de recorrência.
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { Temporal } from '@js-temporal/polyfill';
import { RRuleTemporal } from 'rrule-temporal';
import { expandEvent } from '../dist/esm/core/index.js';

const zone = 'America/New_York';
const cases = [
  ['gap / COUNT', '2024-03-09T02:30:00', 'FREQ=DAILY;COUNT=3', [], []],
  [
    'fold / UTC EXDATE late',
    '2024-11-02T01:30:00',
    'FREQ=DAILY;COUNT=3',
    ['2024-11-03T06:30:00Z'],
    [],
  ],
  ['fold / UTC UNTIL', '2024-11-02T01:30:00', 'FREQ=DAILY;UNTIL=20241103T060000Z', [], []],
  [
    'RDATE / EXDATE / DST',
    '2024-03-08T09:00:00',
    'FREQ=DAILY;COUNT=5',
    ['2024-03-09T14:00:00Z'],
    ['2024-03-10T11:00:00'],
  ],
  ['year of timed events', '2024-01-01T09:00:00', 'FREQ=DAILY;COUNT=366', [], []],
];
const compact = (iso) => iso.replaceAll('-', '').replaceAll(':', '');
const zoned = (iso) => Temporal.PlainDateTime.from(iso).toZonedDateTime(zone);
const descriptor = ({ startInstant, wall }) => ({
  startInstant,
  start: wall.toString(),
  end: wall.add({ hours: 1 }).toString(),
});
function measure(run) {
  for (let index = 0; index < 3; index++) run();
  const samples = [];
  for (let index = 0; index < 25; index++) {
    const begin = performance.now();
    run();
    samples.push(performance.now() - begin);
  }
  samples.sort((a, b) => a - b);
  return { median: +samples[12].toFixed(3), p95: +samples[23].toFixed(3) };
}
const results = [];
for (const [name, start, rule, exDates, rDates] of cases) {
  const event = {
    id: 'probe',
    calendarId: 'test',
    title: 'Probe',
    time: {
      allDay: false,
      start: { dateTime: start, timeZone: zone },
      end: {
        dateTime: Temporal.PlainDateTime.from(start).add({ hours: 1 }).toString(),
        timeZone: zone,
      },
    },
    recurrence: { rule, exDates, rDates },
  };
  const lines = [`DTSTART;TZID=${zone}:${compact(start)}`, `RRULE:${rule}`];
  for (const [type, dates] of [
    ['EXDATE', exDates],
    ['RDATE', rDates],
  ])
    for (const date of dates)
      lines.push(`${type}${date.endsWith('Z') ? '' : `;TZID=${zone}`}:${compact(date)}`);
  const create = () =>
    new RRuleTemporal({ rruleString: lines.join('\n'), cache: false, strict: true });
  const prepared = create();
  const production = () =>
    expandEvent({ temporal: Temporal, event }).map((item) => {
      const wall = Temporal.PlainDateTime.from(item.event.time.start.dateTime);
      return {
        startInstant: zoned(wall.toString()).toInstant().toString(),
        start: wall.toString(),
        end: Temporal.PlainDateTime.from(item.event.time.end.dateTime).toString(),
      };
    });
  const adapted = (instance) =>
    instance.all().map((value) =>
      descriptor({
        startInstant: value.toInstant().toString(),
        wall: Temporal.PlainDateTime.from(value.toPlainDateTime().toString()),
      }),
    );
  const expected = production();
  assert.deepEqual(adapted(prepared), expected, name);
  results.push({
    name,
    occurrences: expected.length,
    output: expected,
    milliseconds: {
      production: measure(production),
      rruleTemporalPrepared: measure(() => adapted(prepared)),
      rruleTemporalWithParsing: measure(() => adapted(create())),
    },
  });
}
const report = {
  checkedAt: new Date().toISOString(),
  node: process.version,
  productionBackend: 'rrule-temporal 2.2.8 + calendar recurrence-set',
  cache: false,
  iterations: 25,
  scope:
    'Timed starts + one-hour wall-clock ends, instants, RDATE/EXDATE, DST. No overrides, constraints, layout or browser timing.',
  results,
};
writeFileSync(
  'experiments/civil-recurrence/event-comparison.json',
  JSON.stringify(report, null, 2) + '\n',
);
console.log(
  JSON.stringify({ ...report, results: results.map(({ output, ...result }) => result) }, null, 2),
);
