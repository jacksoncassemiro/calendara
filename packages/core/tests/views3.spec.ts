// @vitest-environment jsdom
import { Temporal } from "@js-temporal/polyfill";
import { h as createElement } from "preact";
import { describe, expect, it } from "vitest";
import { CalendarApp, type RangeChange } from "../src/render/calendarApp.js";
import type { CalendarEvent } from "../src/types/event.js";
import { createNDaysView } from "../src/views/timeGridViews.js";

const TZ = "America/Sao_Paulo";
const REF = "2026-07-22"; // quarta-feira
const NOW_MS = Number(
	Temporal.PlainDateTime.from("2026-07-22T10:00").toZonedDateTime(TZ)
		.epochMilliseconds,
);

const events: CalendarEvent[] = [
	{
		id: "e1",
		calendarId: "c1",
		title: "Consulta",
		time: {
			allDay: false,
			start: { dateTime: "2026-07-22T09:00:00", timeZone: TZ },
			end: { dateTime: "2026-07-22T10:00:00", timeZone: TZ },
		},
	},
	{
		id: "e2",
		calendarId: "c1",
		title: "Feriado",
		time: {
			allDay: true,
			start: { date: "2026-07-23" },
			end: { date: "2026-07-24" },
		},
	},
	{
		id: "e3",
		calendarId: "c1",
		title: "Reunião semanal",
		time: {
			allDay: false,
			start: { dateTime: "2026-07-01T08:00:00", timeZone: TZ },
			end: { dateTime: "2026-07-01T08:30:00", timeZone: TZ },
		},
		recurrence: { rule: "FREQ=WEEKLY;BYDAY=WE" },
	},
];

function makeApp(overrides: Record<string, unknown> = {}) {
	const container = document.createElement("div");
	document.body.appendChild(container);
	const app = new CalendarApp({
		date: REF,
		view: "week",
		events,
		temporal: Temporal as unknown as never,
		options: {
			timeZone: TZ,
			startHour: 6,
			endHour: 20,
			slotMinutes: 60,
			pxPerMinute: 1,
			nowMs: NOW_MS,
			weekStart: "MO",
			locale: "pt-BR",
		},
		...overrides,
	});
	app.mount(container);
	return { app, container };
}

describe("Fase 3 — Month / List / NDays", () => {
	it("MonthView: 35 células e recorrência semanal expandida (5 quartas)", async () => {
		const { app, container } = makeApp();
		await app.ready();
		app.changeView("month");

		expect(container.querySelectorAll("[data-mc-month-day]")).toHaveLength(35);
		// e3 (semanal, quartas) aparece em 01, 08, 15, 22, 29 de julho.
		expect(
			container.querySelectorAll('[data-mc-month-event^="e3@"]').length,
		).toBe(5);
		// 22/07 tem a consulta (e1) e a reunião semanal (e3).
		const wed22 = container.querySelector(
			'[data-mc-month-day="2026-07-22"]',
		) as HTMLElement;
		expect(wed22.querySelectorAll("[data-mc-month-event]").length).toBe(2);
		app.destroy();
	});

	it("ListView: itens cronológicos agrupados por dia", async () => {
		const { app, container } = makeApp();
		await app.ready();
		app.changeView("list");

		// Semana 20–26/07: e1 (22), e3 (22) e e2 all-day (23) = 3 itens em 2 dias.
		expect(container.querySelectorAll("[data-mc-list-item]")).toHaveLength(3);
		expect(container.querySelectorAll("[data-mc-list-day]")).toHaveLength(2);
		app.destroy();
	});

	it("NDaysView registrada renderiza N colunas", async () => {
		const { app, container } = makeApp();
		await app.ready();
		app.registerView(createNDaysView(3));
		app.changeView("ndays-3");
		expect(container.querySelectorAll("[data-mc-day]")).toHaveLength(3);
		app.destroy();
	});
});

describe("Fase 3 — eventSource (fetch por range)", () => {
	it("busca no range inicial e refaz ao navegar", async () => {
		const calls: RangeChange[] = [];
		const eventSource = (range: RangeChange): CalendarEvent[] => {
			calls.push(range);
			// devolve a consulta só quando o range cobre 22/07
			return range.start <= "2026-07-22" && range.end >= "2026-07-22"
				? [events[0]!]
				: [];
		};
		const container = document.createElement("div");
		document.body.appendChild(container);
		const app = new CalendarApp({
			date: REF,
			view: "week",
			eventSource,
			temporal: Temporal as unknown as never,
			options: {
				timeZone: TZ,
				startHour: 6,
				endHour: 20,
				slotMinutes: 60,
				pxPerMinute: 1,
				nowMs: NOW_MS,
			},
		});
		app.mount(container);
		await app.ready();

		expect(calls[0]).toEqual({ start: "2026-07-20", end: "2026-07-26" });
		expect(container.querySelectorAll("[data-mc-event]").length).toBe(1);

		app.next(); // dispara refetch com o novo range
		expect(calls[calls.length - 1]).toEqual({
			start: "2026-07-27",
			end: "2026-08-02",
		});
		await Promise.resolve();
		await Promise.resolve();
		// fora do range de 22/07 → sem eventos
		expect(container.querySelectorAll("[data-mc-event]").length).toBe(0);
		app.destroy();
	});
});

describe("Fase 3 — slots customizados", () => {
	it("renderEvent injeta conteúdo custom no bloco de evento", async () => {
		const { app, container } = makeApp({
			renderEvent: (info: { event: CalendarEvent }) =>
				createElement(
					"span",
					{ "data-custom-event": info.event.id },
					`» ${info.event.title}`,
				),
		});
		await app.ready();
		const custom = container.querySelector('[data-custom-event="e1"]');
		expect(custom).toBeTruthy();
		expect(custom!.textContent).toContain("Consulta");
		app.destroy();
	});

	it("renderToolbar substitui a toolbar padrão", async () => {
		const { app, container } = makeApp({
			renderToolbar: (toolbar: { title: string }) =>
				createElement("div", { "data-mc-custom-toolbar": "" }, toolbar.title),
		});
		await app.ready();
		expect(container.querySelector("[data-mc-custom-toolbar]")).toBeTruthy();
		expect(container.querySelector("[data-mc-toolbar]")).toBeNull(); // toolbar padrão ausente
		app.destroy();
	});

	it("toolbar padrão navega ao clicar nos botões", async () => {
		const { app, container } = makeApp();
		await app.ready();
		const firstDayBefore = (
			container.querySelector("[data-mc-day]") as HTMLElement
		).dataset.mcDay;
		expect(firstDayBefore).toBe("2026-07-20");
		(container.querySelector("[data-mc-nav-next]") as HTMLElement).click();
		expect(
			(container.querySelector("[data-mc-day]") as HTMLElement).dataset.mcDay,
		).toBe("2026-07-27");
		app.destroy();
	});
});
