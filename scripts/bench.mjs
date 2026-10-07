/**
 * Bench de performance (Fase 6): mede o pipeline headless caro — expandir recorrência num range +
 * projetar em minutos-do-dia (buildDays) + geometria/empacotamento (layoutDay) — para N eventos.
 *
 * Roda contra o build ESM do core:
 *   yarn build   # gera dist/esm e dist/cjs do pacote único
 *   node scripts/bench.mjs [N] [iterações]
 */
import { Temporal } from '@js-temporal/polyfill';
import { expandRange, buildDays, layoutDay, parseRRule, expandRuleAll } from '../dist/esm/core/index.js';

const TZ = 'America/Sao_Paulo';
const eventCount = Number(process.argv[2] ?? 2000);
const iterations = Number(process.argv[3] ?? 20);
if (!Number.isInteger(eventCount) || eventCount <= 0 || !Number.isInteger(iterations) || iterations <= 0) {
	throw new RangeError('Usage: node scripts/bench.mjs [positive event count] [positive iterations]');
}

// Semana de referência (seg 2026-07-20 .. dom 2026-07-26).
const weekDays = [];
for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
	weekDays.push(Temporal.PlainDate.from('2026-07-20').add({ days: dayOffset }));
}

// Gera N eventos: ~30% recorrentes semanais, resto pontuais, espalhados na semana.
function makeEvents(total) {
	const events = [];
	for (let index = 0; index < total; index++) {
		const dayOffset = index % 7;
		const hour = 6 + (index % 12); // 06..17
		const dateISO = `2026-07-${20 + dayOffset}`;
		const isRecurring = index % 10 < 3;
		const event = {
			id: `e${index}`,
			calendarId: 'c1',
			title: `Evento ${index}`,
			time: {
				allDay: false,
				start: { dateTime: `${dateISO}T${String(hour).padStart(2, '0')}:00:00`, timeZone: TZ },
				end: { dateTime: `${dateISO}T${String(hour).padStart(2, '0')}:30:00`, timeZone: TZ },
			},
		};
		if (isRecurring) event.recurrence = { rule: { freq: 'WEEKLY', count: 4 } };
		events.push(event);
	}
	return events;
}

const events = makeEvents(eventCount);
const startISO = '2026-07-20';
const endISO = '2026-07-26';
const grid = { startHour: 6, endHour: 22 };
const geometryGrid = { startHour: 6, endHour: 22, pxPerMinute: 1, minEventMinutes: 15, gutter: 0 };

// Warmup.
for (let index = 0; index < 3; index++) {
	const occurrences = expandRange(Temporal, events, startISO, endISO);
	const days = buildDays(Temporal, weekDays, occurrences, {}, grid, TZ);
	for (const day of days) layoutDay(day.timed, geometryGrid);
}

let totalMs = 0;
let occurrenceCount = 0;
const stageTimes = { parseRules: 0, dateExpansion: 0, eventExpansion: 0, projection: 0, geometry: 0 };
const sampleRules = Array.from({ length: Math.max(1, Math.floor(eventCount * 0.3)) }, () => 'FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=12');
const ruleStart = Temporal.PlainDate.from(startISO);
const ruleOptions = { windowStart: ruleStart, windowEnd: Temporal.PlainDate.from(endISO) };
for (let iteration = 0; iteration < iterations; iteration++) {
	let stageStart = performance.now();
	const models = sampleRules.map(parseRRule);
	stageTimes.parseRules += performance.now() - stageStart;
	stageStart = performance.now();
	for (const model of models) expandRuleAll(Temporal, model, ruleStart, new Set(), 1000, ruleOptions);
	stageTimes.dateExpansion += performance.now() - stageStart;
	const started = performance.now();
	const occurrences = expandRange(Temporal, events, startISO, endISO);
	stageTimes.eventExpansion += performance.now() - started;
	stageStart = performance.now();
	const days = buildDays(Temporal, weekDays, occurrences, {}, grid, TZ);
	stageTimes.projection += performance.now() - stageStart;
	stageStart = performance.now();
	for (const day of days) layoutDay(day.timed, geometryGrid);
	stageTimes.geometry += performance.now() - stageStart;
	totalMs += performance.now() - started;
	occurrenceCount = occurrences.length;
}

const avg = totalMs / iterations;
console.log(`eventos=${eventCount}  ocorrências/expansão=${occurrenceCount}  iterações=${iterations}`);
console.log(`média por render (expand+buildDays+layout, semana): ${avg.toFixed(2)} ms`);
console.log(`throughput: ${Math.round(occurrenceCount / (avg / 1000)).toLocaleString()} ocorrências/s`);
console.log(`runtime=${process.version}; Temporal=@js-temporal/polyfill; timezone=${TZ}`);
for (const [stage, elapsed] of Object.entries(stageTimes)) console.log(`${stage}: ${(elapsed / iterations).toFixed(3)} ms média`);
console.log('parseRules/dateExpansion são microbenchmarks adicionais; não somar ao pipeline eventExpansion+projection+geometry. Sem DOM/React/browser.');
