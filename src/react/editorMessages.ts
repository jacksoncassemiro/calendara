/** Form fields and headings. @remarks Português: Campos e títulos do formulário. */
export interface CalendarEditorFieldMessages {
  /** Edit event @remarks Português: Editar evento */
  formTitle: string;
  /** Edit and reschedule event @remarks Português: Editar e reagendar evento */
  heading: string;
  /** Title @remarks Português: Título */
  title: string;
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
  /** Resources @remarks Português: Recursos */
  resources: string;
}

/** Editor actions and pending state. @remarks Português: Ações e estado de gravação. */
export interface CalendarEditorActionMessages {
  /** Save event @remarks Português: Salvar evento */
  save: string;
  /** Saving… @remarks Português: Salvando… */
  saving: string;
  /** Cancel @remarks Português: Cancelar */
  cancel: string;
  /** Delete event @remarks Português: Excluir evento */
  delete: string;
}

/** Recurrence editing scope. @remarks Português: Escopo de edição recorrente. */
export interface CalendarEditorScopeMessages {
  /** Apply changes @remarks Português: Aplicar alterações */
  label: string;
  /** Only this event @remarks Português: Somente este evento */
  occurrence: string;
  /** This and following events @remarks Português: Este e os seguintes */
  following: string;
  /** Entire series @remarks Português: Toda a série */
  series: string;
}

/** Recurrence controls and hints. @remarks Português: Controles e avisos de recorrência. */
export interface CalendarEditorRecurrenceMessages {
  /** Repeat @remarks Português: Repetir */
  label: string;
  /** Does not repeat @remarks Português: Não repetir */
  none: string;
  /** Every second @remarks Português: A cada segundo */
  secondly: string;
  /** Every minute @remarks Português: A cada minuto */
  minutely: string;
  /** Hourly @remarks Português: A cada hora */
  hourly: string;
  /** Daily @remarks Português: Diariamente */
  daily: string;
  /** Weekly @remarks Português: Semanalmente */
  weekly: string;
  /** Monthly @remarks Português: Mensalmente */
  monthly: string;
  /** Yearly @remarks Português: Anualmente */
  yearly: string;
  /** Recurrence settings @remarks Português: Configuração da repetição */
  settings: string;
  /** Recurrence interval @remarks Português: Intervalo da repetição */
  interval: string;
  /** In seconds @remarks Português: Em segundos */
  inSeconds: string;
  /** In minutes @remarks Português: Em minutos */
  inMinutes: string;
  /** In hours @remarks Português: Em horas */
  inHours: string;
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
  monthDay: string;
  /** Negative month-day hint. @remarks Português: Explicação de dias negativos do mês. */
  monthDayHint: string;
  /** Recurring month @remarks Português: Mês da repetição */
  month: string;
  /** Recurrence end @remarks Português: Fim da repetição */
  end: string;
  /** Never @remarks Português: Nunca */
  never: string;
  /** After a number of occurrences @remarks Português: Após uma quantidade */
  afterCount: string;
  /** Until a date @remarks Português: Até uma data */
  untilDate: string;
  /** Number of occurrences @remarks Português: Quantidade de ocorrências */
  count: string;
  /** Last recurrence date @remarks Português: Data final da repetição */
  until: string;
  /** Advanced-rule preservation hint. @remarks Português: Aviso de preservação da regra avançada. */
  advancedHint: string;
}

/** Built-in validation messages. @remarks Português: Mensagens de validação interna. */
export interface CalendarEditorValidationMessages {
  /** Enter the event title. @remarks Português: Informe o título do evento. */
  titleRequired: string;
  /** The last day must be on or after the start. @remarks Português: O último dia precisa ser igual ou posterior ao início. */
  lastDayInvalid: string;
  /** The end must be after the start. @remarks Português: O término precisa ser posterior ao início. */
  endInvalid: string;
  /** Recurrence must end on or after the start. @remarks Português: O fim da repetição precisa ser igual ou posterior ao início. */
  recurrenceEndInvalid: string;
  /** Select at least one weekday. @remarks Português: Selecione pelo menos um dia da semana. */
  weekdaysRequired: string;
  /** Day of month must be between 1 and 31, or between -31 and -1. @remarks Português: O dia do mês precisa estar entre 1 e 31, ou entre -31 e -1. */
  monthDayInvalid: string;
  /** All-day recurrence rejects intraday frequencies/filters. @remarks Português: Recorrência de dia inteiro rejeita frequências/filtros de horário. */
  allDayRecurrenceInvalid: string;
  /** Format a positive-integer error with a localized field name. @remarks Português: Formata erro de inteiro positivo com o campo traduzido. */
  positiveInteger: (context: CalendarEditorValidationContext) => string;
}

/** Loading and persistence feedback. @remarks Português: Retorno de carregamento e persistência. */
export interface CalendarEditorFeedbackMessages {
  /** Could not load the event time zone. @remarks Português: Não foi possível carregar o fuso horário do evento. */
  timeZoneLoadFailed: string;
  /** Could not delete the event. @remarks Português: Não foi possível excluir o evento. */
  deleteFailed: string;
  /** Could not save the event. @remarks Português: Não foi possível salvar o evento. */
  saveFailed: string;
  /** Could not complete the action. Try again. @remarks Português: Não foi possível concluir. Tente novamente. */
  actionFailed: string;
  /** This event is read-only. @remarks Português: Este evento permite apenas consulta. */
  readOnly: string;
}

/** Data supplied to validation formatters. @remarks Português: Dados enviados aos formatadores de validação. */
export interface CalendarEditorValidationContext {
  /** Localized field name. @remarks Português: Nome traduzido do campo. */
  field: string;
}

/** Complete grouped editor text and formatters. @remarks Português: Textos e formatadores completos do editor por grupo. */
export interface CalendarEditorMessages {
  /** Form fields and headings. @remarks Português: Campos e títulos do formulário. */
  fields: CalendarEditorFieldMessages;
  /** Editor actions and pending state. @remarks Português: Ações e estado de gravação. */
  actions: CalendarEditorActionMessages;
  /** Recurrence editing scope. @remarks Português: Escopo de edição recorrente. */
  scope: CalendarEditorScopeMessages;
  /** Recurrence controls and hints. @remarks Português: Controles e avisos de recorrência. */
  recurrence: CalendarEditorRecurrenceMessages;
  /** Built-in validation messages. @remarks Português: Mensagens de validação interna. */
  validation: CalendarEditorValidationMessages;
  /** Loading and persistence feedback. @remarks Português: Retorno de carregamento e persistência. */
  feedback: CalendarEditorFeedbackMessages;
}

/** Partial grouped editor translations; omitted keys fall back. @remarks Português: Traduções parciais agrupadas; chaves ausentes usam fallback. */
export interface CalendarEditorMessageOverrides {
  /** Form fields and headings. @remarks Português: Campos e títulos do formulário. */
  fields?: Partial<CalendarEditorFieldMessages>;
  /** Editor actions and pending state. @remarks Português: Ações e estado de gravação. */
  actions?: Partial<CalendarEditorActionMessages>;
  /** Recurrence editing scope. @remarks Português: Escopo de edição recorrente. */
  scope?: Partial<CalendarEditorScopeMessages>;
  /** Recurrence controls and hints. @remarks Português: Controles e avisos de recorrência. */
  recurrence?: Partial<CalendarEditorRecurrenceMessages>;
  /** Built-in validation messages. @remarks Português: Mensagens de validação interna. */
  validation?: Partial<CalendarEditorValidationMessages>;
  /** Loading and persistence feedback. @remarks Português: Retorno de carregamento e persistência. */
  feedback?: Partial<CalendarEditorFeedbackMessages>;
}

export const portugueseEditorMessages: CalendarEditorMessages = {
  fields: {
    formTitle: 'Editar evento',
    heading: 'Editar e reagendar evento',
    title: 'Título',
    allDay: 'Dia inteiro',
    timeZone: 'Fuso horário:',
    start: 'Início',
    lastDay: 'Último dia',
    end: 'Término',
    resources: 'Recursos',
  },
  actions: {
    save: 'Salvar evento',
    saving: 'Salvando…',
    cancel: 'Cancelar',
    delete: 'Excluir evento',
  },
  scope: {
    label: 'Aplicar alterações',
    occurrence: 'Somente este evento',
    following: 'Este e os seguintes',
    series: 'Toda a série',
  },
  recurrence: {
    label: 'Repetir',
    none: 'Não repetir',
    secondly: 'A cada segundo',
    minutely: 'A cada minuto',
    hourly: 'A cada hora',
    daily: 'Diariamente',
    weekly: 'Semanalmente',
    monthly: 'Mensalmente',
    yearly: 'Anualmente',
    settings: 'Configuração da repetição',
    interval: 'Intervalo da repetição',
    inSeconds: 'Em segundos',
    inMinutes: 'Em minutos',
    inHours: 'Em horas',
    inDays: 'Em dias',
    inWeeks: 'Em semanas',
    inMonths: 'Em meses',
    inYears: 'Em anos',
    weekdays: 'Dias da semana',
    monthDay: 'Dia do mês da repetição',
    monthDayHint: 'Valores negativos contam a partir do fim do mês: -1 é o último dia.',
    month: 'Mês da repetição',
    end: 'Fim da repetição',
    never: 'Nunca',
    afterCount: 'Após uma quantidade',
    untilDate: 'Até uma data',
    count: 'Quantidade de ocorrências',
    until: 'Data final da repetição',
    advancedHint:
      'As cláusulas avançadas da regra existente são preservadas até que o campo correspondente seja alterado.',
  },
  validation: {
    titleRequired: 'Informe o título do evento.',
    lastDayInvalid: 'O último dia precisa ser igual ou posterior ao início.',
    endInvalid: 'O término precisa ser posterior ao início.',
    recurrenceEndInvalid: 'O fim da repetição precisa ser igual ou posterior ao início.',
    weekdaysRequired: 'Selecione pelo menos um dia da semana.',
    monthDayInvalid: 'O dia do mês precisa estar entre 1 e 31, ou entre -31 e -1.',
    allDayRecurrenceInvalid:
      'Use um evento com horário para recorrência por hora, minuto, segundo ou filtros de horário.',
    positiveInteger: ({ field }) => `${field} precisa ser um inteiro positivo.`,
  },
  feedback: {
    timeZoneLoadFailed: 'Não foi possível carregar o fuso horário do evento.',
    deleteFailed: 'Não foi possível excluir o evento.',
    saveFailed: 'Não foi possível salvar o evento.',
    actionFailed: 'Não foi possível concluir. Tente novamente.',
    readOnly: 'Este evento permite apenas consulta.',
  },
};

export const englishEditorMessages: CalendarEditorMessages = {
  fields: {
    formTitle: 'Edit event',
    heading: 'Edit and reschedule event',
    title: 'Title',
    allDay: 'All day',
    timeZone: 'Time zone:',
    start: 'Start',
    lastDay: 'Last day',
    end: 'End',
    resources: 'Resources',
  },
  actions: {
    save: 'Save event',
    saving: 'Saving…',
    cancel: 'Cancel',
    delete: 'Delete event',
  },
  scope: {
    label: 'Apply changes',
    occurrence: 'Only this event',
    following: 'This and following events',
    series: 'Entire series',
  },
  recurrence: {
    label: 'Repeat',
    none: 'Does not repeat',
    secondly: 'Every second',
    minutely: 'Every minute',
    hourly: 'Hourly',
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    yearly: 'Yearly',
    settings: 'Recurrence settings',
    interval: 'Recurrence interval',
    inSeconds: 'In seconds',
    inMinutes: 'In minutes',
    inHours: 'In hours',
    inDays: 'In days',
    inWeeks: 'In weeks',
    inMonths: 'In months',
    inYears: 'In years',
    weekdays: 'Weekdays',
    monthDay: 'Recurring day of month',
    monthDayHint: 'Negative values count from the end of the month: -1 is the last day.',
    month: 'Recurring month',
    end: 'Recurrence end',
    never: 'Never',
    afterCount: 'After a number of occurrences',
    untilDate: 'Until a date',
    count: 'Number of occurrences',
    until: 'Last recurrence date',
    advancedHint:
      'Advanced clauses in the existing rule are preserved until their corresponding field changes.',
  },
  validation: {
    titleRequired: 'Enter the event title.',
    lastDayInvalid: 'The last day must be on or after the start.',
    endInvalid: 'The end must be after the start.',
    recurrenceEndInvalid: 'Recurrence must end on or after the start.',
    weekdaysRequired: 'Select at least one weekday.',
    monthDayInvalid: 'Day of month must be between 1 and 31, or between -31 and -1.',
    allDayRecurrenceInvalid:
      'Use a timed event for hourly, minutely, secondly recurrence or time filters.',
    positiveInteger: ({ field }) => `${field} must be a positive integer.`,
  },
  feedback: {
    timeZoneLoadFailed: 'Could not load the event time zone.',
    deleteFailed: 'Could not delete the event.',
    saveFailed: 'Could not save the event.',
    actionFailed: 'Could not complete the action. Try again.',
    readOnly: 'This event is read-only.',
  },
};

/** Merge one section without discarding omitted/undefined defaults. @remarks Português: Mescla seção preservando padrões ausentes/undefined. */
function mergeMessageGroup<T extends object>({
  defaults,
  overrides,
}: {
  /** Complete section defaults. @remarks Português: Padrões completos da seção. */
  defaults: T;
  /** Optional section overrides. @remarks Português: Substituições opcionais da seção. */
  overrides: Partial<T> | undefined;
}): T {
  const messages = { ...defaults };
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    const override = overrides?.[key];
    if (override !== undefined) messages[key] = override;
  }
  return messages;
}

/** Resolve consumer overrides against EN/PT defaults. @remarks Português: Resolve substituições do consumidor sobre padrões EN/PT. */
export function resolveEditorMessages({
  locale,
  overrides,
}: {
  /** Editor locale; omitted defaults to pt-BR. @remarks Português: Locale do editor; padrão pt-BR. */
  locale: string | undefined;
  /** Grouped consumer text and formatters. @remarks Português: Textos e formatadores agrupados do consumidor. */
  overrides: CalendarEditorMessageOverrides | undefined;
}): CalendarEditorMessages {
  const defaults = locale?.toLowerCase().startsWith('en')
    ? englishEditorMessages
    : portugueseEditorMessages;
  return {
    fields: mergeMessageGroup({ defaults: defaults.fields, overrides: overrides?.fields }),
    actions: mergeMessageGroup({ defaults: defaults.actions, overrides: overrides?.actions }),
    scope: mergeMessageGroup({ defaults: defaults.scope, overrides: overrides?.scope }),
    recurrence: mergeMessageGroup({
      defaults: defaults.recurrence,
      overrides: overrides?.recurrence,
    }),
    validation: mergeMessageGroup({
      defaults: defaults.validation,
      overrides: overrides?.validation,
    }),
    feedback: mergeMessageGroup({ defaults: defaults.feedback, overrides: overrides?.feedback }),
  };
}
