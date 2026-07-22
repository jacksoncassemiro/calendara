/**
 * Bench de performance (Fase 6): mede o pipeline headless caro — expandir recorrência num range +
 * projetar em minutos-do-dia (buildDays) + geometria/empacotamento (layoutDay) — para N eventos.
 *
 * Roda contra o build ESM do core:
 *   yarn workspace @meucalendario/core run build   # gera packages/core/dist
 *   node scripts/bench.mjs [N] [iterações]
 */
import { Temporal } from '@js-temporal/polyfill';
import { expandRange, buildDays, layoutDay } from '../packages/core/dist/esm/index.js';

const TZ = 'America/Sao_Paulo';
const eventCount = Number(process.argv[2] ?? 2000);
const iterations = Number(process.argv[3] ?? 20);

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
for (let iteration = 0; iteration < iterations; iteration++) {
	const started = performance.now();
	const occurrences = expandRange(Temporal, events, startISO, endISO);
	const days = buildDays(Temporal, weekDays, occurrences, {}, grid, TZ);
	for (const day of days) layoutDay(day.timed, geometryGrid);
	totalMs += performance.now() - started;
	occurrenceCount = occurrences.length;
}

const avg = totalMs / iterations;
console.log(`eventos=${eventCount}  ocorrências/expansão=${occurrenceCount}  iterações=${iterations}`);
console.log(`média por render (expand+buildDays+layout, semana): ${avg.toFixed(2)} ms`);
console.log(`throughput: ${Math.round(occurrenceCount / (avg / 1000)).toLocaleString()} ocorrências/s`);
