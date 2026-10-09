import { buildDays, expandRange, occurrenceKey } from '../core/index.js';
import type { CalendarEvent, CalendarResource, TemporalLike } from '../core/index.js';

/** Browser print settings; PDF is available through the browser dialog.
 * @remarks Português: Opções de impressão; PDF pelo diálogo do navegador
 */
export interface CalendarPrintOptions {
  /** Document heading; defaults to the view title.
   * @remarks Português: Título do documento; padrão é o título da view
   */
  title?: string;
  /** Paper orientation; default portrait.
   * @remarks Português: Orientação do papel; padrão portrait
   */
  orientation?: 'portrait' | 'landscape';
}

/** Complete visible-range snapshot, independent of rendered resource windows.
 * @remarks Português: Período completo, independente do recorte de recursos renderizado
 */
export interface CalendarPrintInput {
  /** Date implementation.
   * @remarks Português: Implementação de datas
   */
  temporal: TemporalLike;
  /** Canonical events, expanded for the print range.
   * @remarks Português: Eventos canônicos expandidos para impressão
   */
  events: readonly CalendarEvent[];
  /** Resource labels.
   * @remarks Português: Nomes dos recursos
   */
  resources: readonly CalendarResource[];
  /** Inclusive first ISO date.
   * @remarks Português: Primeira data ISO inclusiva
   */
  startISO: string;
  /** Inclusive last ISO date.
   * @remarks Português: Última data ISO inclusiva
   */
  endISO: string;
  /** Display locale.
   * @remarks Português: Idioma de exibição
   */
  locale: string;
  /** Display IANA zone.
   * @remarks Português: Fuso IANA de exibição
   */
  timeZone: string;
  /** View title used when no custom title is supplied.
   * @remarks Português: Título da view quando não há título próprio
   */
  title: string;
  /** Paper settings.
   * @remarks Português: Opções do papel
   */
  options?: CalendarPrintOptions;
}

function escapeHTML(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );
}

/** Build a safe, light-paper agenda including continuations and exclusive ends.
 * @remarks Português: Gera agenda segura para papel com continuações e fins exclusivos
 */
export function buildCalendarPrintDocument(input: CalendarPrintInput): string {
  const { temporal, locale, timeZone } = input;
  const english = locale.startsWith('en');
  const dates = [];
  const lastDate = temporal.PlainDate.from(input.endISO);
  for (
    let date = temporal.PlainDate.from(input.startISO);
    temporal.PlainDate.compare(date, lastDate) <= 0;
    date = date.add({ days: 1 })
  )
    dates.push(date);
  const occurrences = expandRange({
    temporal,
    events: input.events,
    startISO: input.startISO,
    endISO: input.endISO,
    displayTimeZone: timeZone,
  });
  const days = buildDays({
    temporal,
    days: dates,
    occurrences,
    constraints: {},
    grid: { startHour: 0, endHour: 24 },
    displayTimeZone: timeZone,
  });
  const resourceNames = new Map(input.resources.map((resource) => [resource.id, resource.title]));
  const title = escapeHTML(input.options?.title ?? input.title);
  const sections = days
    .map((day) => {
      const items = [
        ...day.allDay,
        ...day.timed
          .sort((left, right) => left.startMin - right.startMin)
          .map((item) => item.occurrence),
      ];
      const rows = items
        .map((occurrence) => {
          const time = occurrence.event.time;
          const interval = time.allDay
            ? `${english ? 'All day' : 'Dia inteiro'} · ${time.start.date} – ${temporal.PlainDate.from(time.end.date!).subtract({ days: 1 })}`
            : [time.start, time.end]
                .map((endpoint) =>
                  temporal.PlainDateTime.from(endpoint.dateTime!)
                    .toZonedDateTime(endpoint.timeZone ?? timeZone)
                    .withTimeZone(timeZone)
                    .toPlainDateTime()
                    .toString({ smallestUnit: 'minute' })
                    .replace('T', ' '),
                )
                .join(' – ');
          const resources = (occurrence.event.resourceIds ?? [])
            .map((id) => resourceNames.get(id) ?? id)
            .join(', ');
          return `<tr data-occurrence="${escapeHTML(occurrenceKey(occurrence))}"><td>${escapeHTML(interval)}</td><td>${escapeHTML(occurrence.event.title)}</td><td>${escapeHTML(resources)}</td></tr>`;
        })
        .join('');
      return `<section><h2>${escapeHTML(day.date.toLocaleString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</h2>${rows ? `<table><thead><tr><th>${english ? 'Interval' : 'Intervalo'}</th><th>${english ? 'Event' : 'Evento'}</th><th>${english ? 'Resources' : 'Recursos'}</th></tr></thead><tbody>${rows}</tbody></table>` : `<p>${english ? 'No events.' : 'Nenhum evento.'}</p>`}</section>`;
    })
    .join('');
  const orientation = input.options?.orientation === 'landscape' ? 'landscape' : 'portrait';
  return `<!doctype html><html lang="${escapeHTML(locale)}"><head><meta charset="utf-8"><title>${title}</title><style>@page{size:A4 ${orientation};margin:14mm}body{font:12px system-ui;color:#111;background:white;margin:0}h1{font-size:22px}h2{font-size:15px;break-after:avoid}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{text-align:left;padding:8px;border-bottom:1px solid #bbb;overflow-wrap:anywhere}th:first-child{width:34%}tr{break-inside:avoid}thead{display:table-header-group}section{margin:24px 0}p{color:#333}</style></head><body><h1>${title}</h1><p>${escapeHTML(input.startISO)} – ${escapeHTML(input.endISO)} · ${escapeHTML(timeZone)}</p>${sections}</body></html>`;
}

/** Open the native print dialog for an isolated document; call from a user action.
 * @remarks Português: Abre diálogo nativo em documento isolado; chame por ação do usuário
 */
export function printCalendarDocument(html: string): boolean {
  if (typeof document === 'undefined') return false;
  const frame = document.createElement('iframe');
  frame.title = 'Calendar print / Impressão da agenda';
  frame.style.cssText = 'position:fixed;width:1px;height:1px;left:-10000px;border:0';
  frame.onload = () => {
    const printWindow = frame.contentWindow;
    if (!printWindow) {
      frame.remove();
      return;
    }
    printWindow.addEventListener('afterprint', () => frame.remove(), { once: true });
    printWindow.focus();
    printWindow.print();
  };
  frame.srcdoc = html;
  document.body.append(frame);
  return true;
}
