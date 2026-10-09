/** Optional editor copy; resource titles and consumer errors stay consumer-owned. @remarks Português: Textos do editor; títulos dos recursos e erros externos pertencem ao consumidor. */
export interface CalendarEditorMessages {
  /** All-day recurrence rejects intraday frequencies/filters. @remarks Português: Recorrência de dia inteiro rejeita frequências/filtros de horário. */
  allDayRecurrenceInvalid: string;
  /** Could not load the event time zone. @remarks Português: Não foi possível carregar o fuso horário do evento. */
  timeZoneLoadFailed: string;
  /** Could not delete the event. @remarks Português: Não foi possível excluir o evento. */
  deleteFailed: string;
  /** Enter the event title. @remarks Português: Informe o título do evento. */
  titleRequired: string;
  /** The last day must be on or after the start. @remarks Português: O último dia precisa ser igual ou posterior ao início. */
  lastDayInvalid: string;
  /** The end must be after the start. @remarks Português: O término precisa ser posterior ao início. */
  endInvalid: string;
  /** Interval @remarks Português: O intervalo */
  intervalName: string;
  /** Occurrence count @remarks Português: A quantidade de ocorrências */
  countName: string;
  /** Recurrence must end on or after the start. @remarks Português: O fim da repetição precisa ser igual ou posterior ao início. */
  recurrenceEndInvalid: string;
  /** Select at least one weekday. @remarks Português: Selecione pelo menos um dia da semana. */
  weekdaysRequired: string;
  /** Day of month must be between 1 and 31, or between -31 and -1. @remarks Português: O dia do mês precisa estar entre 1 e 31, ou entre -31 e -1. */
  monthDayInvalid: string;
  /** Month @remarks Português: O mês */
  monthName: string;
  /** Could not save the event. @remarks Português: Não foi possível salvar o evento. */
  saveFailed: string;
  /** Could not complete the action. Try again. @remarks Português: Não foi possível concluir. Tente novamente. */
  actionFailed: string;
  /** Edit event @remarks Português: Editar evento */
  editEvent: string;
  /** Edit and reschedule event @remarks Português: Editar e reagendar evento */
  editAndReschedule: string;
  /** This event is read-only. @remarks Português: Este evento permite apenas consulta. */
  readOnly: string;
  /** Title @remarks Português: Título */
  title: string;
  /** Apply changes @remarks Português: Aplicar alterações */
  applyChanges: string;
  /** Only this event @remarks Português: Somente este evento */
  onlyOccurrence: string;
  /** This and following events @remarks Português: Este e os seguintes */
  followingOccurrences: string;
  /** Entire series @remarks Português: Toda a série */
  entireSeries: string;
  /** All day @remarks Português: Dia inteiro */
  allDay: string;
  /** Time zone: @remarks Português: Fuso horário: */
  timeZone: string;
  /** Start @remarks Português: Início */
  start: string;
  /** Last day @remarks Português: Último dia */
  lastDay: string;
  /** End @remarks Português: Término */
  end: string;
  /** Repeat @remarks Português: Repetir */
  repeat: string;
  /** Does not repeat @remarks Português: Não repetir */
  noRepeat: string;
  /** Daily @remarks Português: Diariamente */
  daily: string;
  /** Weekly @remarks Português: Semanalmente */
  weekly: string;
  /** Monthly @remarks Português: Mensalmente */
  monthly: string;
  /** Yearly @remarks Português: Anualmente */
  yearly: string;
  /** Recurrence settings @remarks Português: Configuração da repetição */
  recurrenceSettings: string;
  /** Recurrence interval @remarks Português: Intervalo da repetição */
  recurrenceInterval: string;
  /** In days @remarks Português: Em dias */
  inDays: string;
  /** In weeks @remarks Português: Em semanas */
  inWeeks: string;
  /** In months @remarks Português: Em meses */
  inMonths: string;
  /** In years @remarks Português: Em anos */
  inYears: string;
  /** Weekdays @remarks Português: Dias da semana */
  weekdays: string;
  /** Recurring day of month @remarks Português: Dia do mês da repetição */
  recurringMonthDay: string;
  /** Negative month-day hint. @remarks Português: Explicação de dias negativos do mês. */
  negativeMonthDayHint: string;
  /** Recurring month @remarks Português: Mês da repetição */
  recurringMonth: string;
  /** Recurrence end @remarks Português: Fim da repetição */
  recurrenceEnd: string;
  /** Never @remarks Português: Nunca */
  never: string;
  /** After a number of occurrences @remarks Português: Após uma quantidade */
  afterCount: string;
  /** Until a date @remarks Português: Até uma data */
  untilDate: string;
  /** Number of occurrences @remarks Português: Quantidade de ocorrências */
  occurrenceCount: string;
  /** Last recurrence date @remarks Português: Data final da repetição */
  lastRecurrenceDate: string;
  /** Advanced-rule preservation hint. @remarks Português: Aviso de preservação da regra avançada. */
  advancedRuleHint: string;
  /** Resources @remarks Português: Recursos */
  resources: string;
  /** Saving… @remarks Português: Salvando… */
  saving: string;
  /** Save event @remarks Português: Salvar evento */
  saveEvent: string;
  /** Cancel @remarks Português: Cancelar */
  cancel: string;
  /** Delete event @remarks Português: Excluir evento */
  deleteEvent: string;
  /** Every second @remarks Português: A cada segundo */
  secondly: string;
  /** Every minute @remarks Português: A cada minuto */
  minutely: string;
  /** Hourly @remarks Português: A cada hora */
  hourly: string;
  /** In seconds @remarks Português: Em segundos */
  inSeconds: string;
  /** In minutes @remarks Português: Em minutos */
  inMinutes: string;
  /** In hours @remarks Português: Em horas */
  inHours: string;
  /** Positive-integer error; {field} is replaced with the field name. @remarks Português: Erro de inteiro positivo; {field} recebe o nome do campo. */
  positiveIntegerError: string;
}

export const portugueseEditorMessages: CalendarEditorMessages = {
  allDayRecurrenceInvalid:
    'Use um evento com horário para recorrência por hora, minuto, segundo ou filtros de horário.',
  timeZoneLoadFailed: 'Não foi possível carregar o fuso horário do evento.',
  deleteFailed: 'Não foi possível excluir o evento.',
  titleRequired: 'Informe o título do evento.',
  lastDayInvalid: 'O último dia precisa ser igual ou posterior ao início.',
  endInvalid: 'O término precisa ser posterior ao início.',
  intervalName: 'O intervalo',
  countName: 'A quantidade de ocorrências',
  recurrenceEndInvalid: 'O fim da repetição precisa ser igual ou posterior ao início.',
  weekdaysRequired: 'Selecione pelo menos um dia da semana.',
  monthDayInvalid: 'O dia do mês precisa estar entre 1 e 31, ou entre -31 e -1.',
  monthName: 'O mês',
  saveFailed: 'Não foi possível salvar o evento.',
  actionFailed: 'Não foi possível concluir. Tente novamente.',
  editEvent: 'Editar evento',
  editAndReschedule: 'Editar e reagendar evento',
  readOnly: 'Este evento permite apenas consulta.',
  title: 'Título',
  applyChanges: 'Aplicar alterações',
  onlyOccurrence: 'Somente este evento',
  followingOccurrences: 'Este e os seguintes',
  entireSeries: 'Toda a série',
  allDay: 'Dia inteiro',
  timeZone: 'Fuso horário:',
  start: 'Início',
  lastDay: 'Último dia',
  end: 'Término',
  repeat: 'Repetir',
  noRepeat: 'Não repetir',
  daily: 'Diariamente',
  weekly: 'Semanalmente',
  monthly: 'Mensalmente',
  yearly: 'Anualmente',
  recurrenceSettings: 'Configuração da repetição',
  recurrenceInterval: 'Intervalo da repetição',
  inDays: 'Em dias',
  inWeeks: 'Em semanas',
  inMonths: 'Em meses',
  inYears: 'Em anos',
  weekdays: 'Dias da semana',
  recurringMonthDay: 'Dia do mês da repetição',
  negativeMonthDayHint: 'Valores negativos contam a partir do fim do mês: -1 é o último dia.',
  recurringMonth: 'Mês da repetição',
  recurrenceEnd: 'Fim da repetição',
  never: 'Nunca',
  afterCount: 'Após uma quantidade',
  untilDate: 'Até uma data',
  occurrenceCount: 'Quantidade de ocorrências',
  lastRecurrenceDate: 'Data final da repetição',
  advancedRuleHint:
    'As cláusulas avançadas da regra existente são preservadas até que o campo correspondente seja alterado.',
  resources: 'Recursos',
  saving: 'Salvando…',
  saveEvent: 'Salvar evento',
  cancel: 'Cancelar',
  deleteEvent: 'Excluir evento',
  secondly: 'A cada segundo',
  minutely: 'A cada minuto',
  hourly: 'A cada hora',
  inSeconds: 'Em segundos',
  inMinutes: 'Em minutos',
  inHours: 'Em horas',
  positiveIntegerError: '{field} precisa ser um inteiro positivo.',
};

export const englishEditorMessages: CalendarEditorMessages = {
  allDayRecurrenceInvalid:
    'Use a timed event for hourly, minutely, secondly recurrence or time filters.',
  timeZoneLoadFailed: 'Could not load the event time zone.',
  deleteFailed: 'Could not delete the event.',
  titleRequired: 'Enter the event title.',
  lastDayInvalid: 'The last day must be on or after the start.',
  endInvalid: 'The end must be after the start.',
  intervalName: 'Interval',
  countName: 'Occurrence count',
  recurrenceEndInvalid: 'Recurrence must end on or after the start.',
  weekdaysRequired: 'Select at least one weekday.',
  monthDayInvalid: 'Day of month must be between 1 and 31, or between -31 and -1.',
  monthName: 'Month',
  saveFailed: 'Could not save the event.',
  actionFailed: 'Could not complete the action. Try again.',
  editEvent: 'Edit event',
  editAndReschedule: 'Edit and reschedule event',
  readOnly: 'This event is read-only.',
  title: 'Title',
  applyChanges: 'Apply changes',
  onlyOccurrence: 'Only this event',
  followingOccurrences: 'This and following events',
  entireSeries: 'Entire series',
  allDay: 'All day',
  timeZone: 'Time zone:',
  start: 'Start',
  lastDay: 'Last day',
  end: 'End',
  repeat: 'Repeat',
  noRepeat: 'Does not repeat',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
  recurrenceSettings: 'Recurrence settings',
  recurrenceInterval: 'Recurrence interval',
  inDays: 'In days',
  inWeeks: 'In weeks',
  inMonths: 'In months',
  inYears: 'In years',
  weekdays: 'Weekdays',
  recurringMonthDay: 'Recurring day of month',
  negativeMonthDayHint: 'Negative values count from the end of the month: -1 is the last day.',
  recurringMonth: 'Recurring month',
  recurrenceEnd: 'Recurrence end',
  never: 'Never',
  afterCount: 'After a number of occurrences',
  untilDate: 'Until a date',
  occurrenceCount: 'Number of occurrences',
  lastRecurrenceDate: 'Last recurrence date',
  advancedRuleHint:
    'Advanced clauses in the existing rule are preserved until their corresponding field changes.',
  resources: 'Resources',
  saving: 'Saving…',
  saveEvent: 'Save event',
  cancel: 'Cancel',
  deleteEvent: 'Delete event',
  secondly: 'Every second',
  minutely: 'Every minute',
  hourly: 'Hourly',
  inSeconds: 'In seconds',
  inMinutes: 'In minutes',
  inHours: 'In hours',
  positiveIntegerError: '{field} must be a positive integer.',
};
