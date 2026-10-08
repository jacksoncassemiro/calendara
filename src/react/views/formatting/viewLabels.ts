const portuguese = {
  allDay: 'dia inteiro',
  newInterval: 'Novo intervalo',
  changingEvent: 'Alterando evento',
  noEventsPeriod: 'Nenhum evento neste período.',
  noEventsDay: 'Nenhum evento neste dia.',
  more: 'mais',
  moreEvents: 'Mais',
  events: 'eventos',
  event: 'evento',
  monthLegend: 'Contorno: hoje · Fundo: dia selecionado · ● quantidade de eventos',
  onDate: 'em',
  unavailableRange: 'sem horários disponíveis na faixa exibida',
  selectedDayEvents: 'Eventos do dia selecionado',
  createEventDay: 'Criar evento neste dia',
  closeEvents: 'Fechar lista de eventos',
  unavailableDays:
    'Dias hachurados: sem horários disponíveis na faixa exibida, pelas regras gerais do calendário. A disponibilidade de cada recurso pode variar.',
};

const english: typeof portuguese = {
  allDay: 'all day',
  newInterval: 'New interval',
  changingEvent: 'Changing event',
  noEventsPeriod: 'No events in this period.',
  noEventsDay: 'No events on this day.',
  more: 'more',
  moreEvents: 'More',
  events: 'events',
  event: 'event',
  monthLegend: 'Outline: today · Fill: selected day · ● event count',
  onDate: 'on',
  unavailableRange: 'no available times in the displayed range',
  selectedDayEvents: 'Events on the selected day',
  createEventDay: 'Create event on this day',
  closeEvents: 'Close event list',
  unavailableDays:
    'Hatched days have no available times in the displayed range under the calendar rules. Availability may differ by resource.',
};

/** Built-in view labels; unsupported locales retain Portuguese.
 * @remarks Português: Textos das views; idiomas não suportados mantêm português.
 */
export function getViewLabels(locale?: string): typeof portuguese {
  return locale?.startsWith('en') ? english : portuguese;
}
