/** @jsxImportSource react */
import { useEffect, useId, useRef, useState } from 'react';
import {
  ensureTemporal,
  parseRRule,
  serializeRRule,
  type CalendarEvent,
  type CalendarResource,
  type EventOccurrence,
  type Frequency,
  type RRuleModel,
  type TemporalLike,
  type WeekdayCode,
} from '../core/index.js';

const WEEKDAYS: readonly [WeekdayCode, string][] = [
  ['MO', 'Segunda-feira'],
  ['TU', 'Terça-feira'],
  ['WE', 'Quarta-feira'],
  ['TH', 'Quinta-feira'],
  ['FR', 'Sexta-feira'],
  ['SA', 'Sábado'],
  ['SU', 'Domingo'],
];
const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

type RecurrenceEnd = 'never' | 'count' | 'until';
type RecurrenceField = 'frequency' | 'interval' | 'end' | 'weekdays' | 'monthDay' | 'month';

function parsePositiveInteger(value: string, label: string, english: boolean): number {
  const parsedInteger = Number(value);
  if (!value.trim() || !Number.isSafeInteger(parsedInteger) || parsedInteger <= 0) {
    throw new Error(
      `${label}${english ? ' must be a positive integer.' : ' precisa ser um inteiro positivo.'}`,
    );
  }
  return parsedInteger;
}

export type CalendarEditScope = 'occurrence' | 'following' | 'series';
export interface CalendarEditorContext {
  scope: CalendarEditScope;
  occurrence?: EventOccurrence;
}
export interface CalendarEventEditorProps {
  event: CalendarEvent;
  occurrence?: EventOccurrence;
  resources?: readonly CalendarResource[];
  timeZone?: string;
  /** Editor language: English for en locales, Portuguese otherwise; default pt-BR.
   * @remarks Português: Idioma do editor: inglês em locales en; português nos demais. Padrão pt-BR.
   */
  locale?: string;
  temporal?: TemporalLike;
  /** Return an error message to reject the draft before persistence (constraints/capacity). */
  validate?: (
    event: CalendarEvent,
    context: CalendarEditorContext,
  ) => string | undefined | Promise<string | undefined>;
  onSave: (
    event: CalendarEvent,
    context: CalendarEditorContext,
  ) => void | boolean | Promise<void | boolean>;
  onDelete?: (
    event: CalendarEvent,
    context: CalendarEditorContext,
  ) => void | boolean | Promise<void | boolean>;
  onCancel: () => void;
}

function previousDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/** Optional accessible form. Mount with key=occurrence key when switching the edited event. */
export function CalendarEventEditor(props: CalendarEventEditorProps) {
  const { event } = props;
  const english = props.locale?.startsWith('en') ?? false;
  const t = (portuguese: string, englishText: string) => (english ? englishText : portuguese);
  const id = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const [title, setTitle] = useState(event.title);
  const [allDay, setAllDay] = useState(event.time.allDay);
  const [start, setStart] = useState(event.time.start.date ?? event.time.start.dateTime ?? '');
  const [end, setEnd] = useState(
    event.time.allDay ? previousDate(event.time.end.date!) : (event.time.end.dateTime ?? ''),
  );
  const [resourceIds, setResourceIds] = useState(event.resourceIds ?? []);
  const [scope, setScope] = useState<CalendarEditScope>(props.occurrence ? 'occurrence' : 'series');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const originalRule = event.recurrence?.rule;
  const parsedRule = typeof originalRule === 'string' ? parseRRule(originalRule) : originalRule;
  const [frequency, setFrequency] = useState<Frequency | ''>(parsedRule?.freq ?? '');
  const [ruleChanged, setRuleChanged] = useState(false);
  const changedRuleFields = useRef(new Set<RecurrenceField>());
  const markRuleField = (field: RecurrenceField) => {
    changedRuleFields.current.add(field);
    setRuleChanged(true);
  };
  const initialDate = (event.time.start.date ?? event.time.start.dateTime ?? '').slice(0, 10);
  const initialWeekday =
    WEEKDAYS[(new Date(`${initialDate}T00:00:00Z`).getUTCDay() + 6) % 7]?.[0] ?? 'MO';
  const [repeatInterval, setRepeatInterval] = useState(String(parsedRule?.interval ?? 1));
  const [repeatEnd, setRepeatEnd] = useState<RecurrenceEnd>(
    parsedRule?.count ? 'count' : parsedRule?.until ? 'until' : 'never',
  );
  const [repeatCount, setRepeatCount] = useState(String(parsedRule?.count ?? 10));
  const [repeatUntil, setRepeatUntil] = useState(parsedRule?.until?.slice(0, 10) ?? initialDate);
  const [repeatWeekdays, setRepeatWeekdays] = useState<WeekdayCode[]>(
    parsedRule?.byDay?.map((entry) => entry.weekday) ?? [initialWeekday],
  );
  const [repeatMonthDay, setRepeatMonthDay] = useState(
    String(parsedRule?.byMonthDay?.[0] ?? Number(initialDate.slice(8, 10))),
  );
  const [repeatMonth, setRepeatMonth] = useState(
    String(parsedRule?.byMonth?.[0] ?? Number(initialDate.slice(5, 7))),
  );
  const recurring = !!event.recurrence || (!!props.occurrence && !props.occurrence.isMaster);
  const readOnly = event.editable === false;
  const usesMonthDay = frequency === 'MONTHLY' || frequency === 'YEARLY';
  useEffect(() => {
    titleRef.current?.focus();
    if (event.time.allDay) return;
    let active = true;
    void (props.temporal ? Promise.resolve(props.temporal) : ensureTemporal())
      .then((temporal) => {
        if (!active) return;
        const calendarTimeZone = props.timeZone ?? event.time.start.timeZone ?? 'UTC';
        const projectToCalendarTimeZone = (dateTime: string, sourceZone: string | undefined) =>
          temporal.PlainDateTime.from(dateTime)
            .toZonedDateTime(sourceZone ?? calendarTimeZone)
            .withTimeZone(calendarTimeZone)
            .toPlainDateTime()
            .toString({ smallestUnit: 'second' });
        setStart(projectToCalendarTimeZone(event.time.start.dateTime!, event.time.start.timeZone));
        setEnd(projectToCalendarTimeZone(event.time.end.dateTime!, event.time.end.timeZone));
      })
      .catch(() => {
        if (active)
          setError(
            t(
              'Não foi possível carregar o fuso horário do evento.',
              'Could not load the event time zone.',
            ),
          );
      });
    return () => {
      active = false;
    };
  }, []);

  const context: CalendarEditorContext = {
    scope,
    ...(props.occurrence ? { occurrence: props.occurrence } : {}),
  };
  const persistEditorChanges = async (deleteRequested: boolean) => {
    if (busyRef.current || readOnly) return;
    busyRef.current = true;
    setPending(true);
    setError('');
    try {
      if (deleteRequested) {
        if ((await props.onDelete?.(event, context)) === false)
          throw new Error(t('Não foi possível excluir o evento.', 'Could not delete the event.'));
        return;
      }
      if (!title.trim())
        throw new Error(t('Informe o título do evento.', 'Enter the event title.'));
      const temporal = props.temporal ?? (await ensureTemporal());
      const calendarTimeZone = props.timeZone ?? event.time.start.timeZone ?? 'UTC';
      let time: CalendarEvent['time'];
      if (allDay) {
        const startDate = temporal.PlainDate.from(start);
        const endDate = temporal.PlainDate.from(end);
        if (temporal.PlainDate.compare(endDate, startDate) < 0)
          throw new Error(
            t(
              'O último dia precisa ser igual ou posterior ao início.',
              'The last day must be on or after the start.',
            ),
          );
        time = {
          allDay: true,
          start: { date: startDate.toString() },
          end: { date: endDate.add({ days: 1 }).toString() },
        };
      } else {
        const startDate = temporal.PlainDateTime.from(start);
        const endDate = temporal.PlainDateTime.from(end);
        const zonedStart = startDate.toZonedDateTime(calendarTimeZone, {
          disambiguation: 'reject',
        });
        const zonedEnd = endDate.toZonedDateTime(calendarTimeZone, {
          disambiguation: 'reject',
        });
        if (zonedEnd.epochMilliseconds <= zonedStart.epochMilliseconds)
          throw new Error(
            t('O término precisa ser posterior ao início.', 'The end must be after the start.'),
          );
        time = {
          allDay: false,
          start: { dateTime: startDate.toString(), timeZone: calendarTimeZone },
          end: { dateTime: endDate.toString(), timeZone: calendarTimeZone },
        };
      }
      const updated: CalendarEvent = {
        ...event,
        title: title.trim(),
        time,
        resourceIds,
      };
      if (scope === 'series' && ruleChanged) {
        if (frequency) {
          const modifiedRuleFields = changedRuleFields.current;
          const shouldUpdateRuleField = (field: RecurrenceField) =>
            !parsedRule || modifiedRuleFields.has(field);
          const rule: RRuleModel = { ...parsedRule, freq: frequency };
          if (shouldUpdateRuleField('interval'))
            rule.interval = parsePositiveInteger(
              repeatInterval,
              t('O intervalo', 'Interval'),
              english,
            );
          if (shouldUpdateRuleField('end')) {
            delete rule.count;
            delete rule.until;
            if (repeatEnd === 'count')
              rule.count = parsePositiveInteger(
                repeatCount,
                t('A quantidade de ocorrências', 'Occurrence count'),
                english,
              );
            if (repeatEnd === 'until') {
              const endDate = temporal.PlainDate.from(repeatUntil);
              if (
                temporal.PlainDate.compare(endDate, temporal.PlainDate.from(start.slice(0, 10))) < 0
              )
                throw new Error(
                  t(
                    'O fim da repetição precisa ser igual ou posterior ao início.',
                    'Recurrence must end on or after the start.',
                  ),
                );
              rule.until = endDate.toString();
            }
          }
          if (frequency === 'WEEKLY' && shouldUpdateRuleField('weekdays')) {
            if (!repeatWeekdays.length)
              throw new Error(
                t('Selecione pelo menos um dia da semana.', 'Select at least one weekday.'),
              );
            rule.byDay = repeatWeekdays.map((weekday) => ({ weekday }));
          }
          if (usesMonthDay && shouldUpdateRuleField('monthDay')) {
            const day = Number(repeatMonthDay);
            if (
              !repeatMonthDay.trim() ||
              !Number.isSafeInteger(day) ||
              day === 0 ||
              Math.abs(day) > 31
            )
              throw new Error(
                t(
                  'O dia do mês precisa estar entre 1 e 31, ou entre -31 e -1.',
                  'Day of month must be between 1 and 31, or between -31 and -1.',
                ),
              );
            rule.byMonthDay = [day];
          }
          if (frequency === 'YEARLY' && shouldUpdateRuleField('month'))
            rule.byMonth = [parsePositiveInteger(repeatMonth, t('O mês', 'Month'), english)];
          // Validate the complete rule while retaining every untouched advanced clause.
          parseRRule(serializeRRule(rule));
          updated.recurrence = { ...event.recurrence, rule };
        } else delete updated.recurrence;
      }
      const validationError = await props.validate?.(updated, context);
      if (validationError) throw new Error(validationError);
      if ((await props.onSave(updated, context)) === false)
        throw new Error(t('Não foi possível salvar o evento.', 'Could not save the event.'));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t(
              'Não foi possível concluir. Tente novamente.',
              'Could not complete the action. Try again.',
            ),
      );
    } finally {
      busyRef.current = false;
      setPending(false);
    }
  };

  return (
    <form
      className="mc-event-editor"
      aria-label={t('Editar evento', 'Edit event')}
      aria-busy={pending}
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        void persistEditorChanges(false);
      }}
    >
      <fieldset disabled={pending || readOnly}>
        <legend>{t('Editar e reagendar evento', 'Edit and reschedule event')}</legend>
        {readOnly && <p>{t('Este evento permite apenas consulta.', 'This event is read-only.')}</p>}
        <label htmlFor={`${id}-title`}>{t('Título', 'Title')}</label>
        <input
          ref={titleRef}
          id={`${id}-title`}
          value={title}
          required
          onChange={(changeEvent) => setTitle(changeEvent.target.value)}
        />
        {recurring && (
          <>
            <label htmlFor={`${id}-scope`}>{t('Aplicar alterações', 'Apply changes')}</label>
            <select
              id={`${id}-scope`}
              value={scope}
              onChange={(changeEvent) => setScope(changeEvent.target.value as CalendarEditScope)}
            >
              {props.occurrence && (
                <option value="occurrence">{t('Somente este evento', 'Only this event')}</option>
              )}
              {props.occurrence && parsedRule && (
                <option value="following">
                  {t('Este e os seguintes', 'This and following events')}
                </option>
              )}
              <option value="series">{t('Toda a série', 'Entire series')}</option>
            </select>
          </>
        )}
        <label className="mc-editor-check">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(changeEvent) => {
              const isAllDayChecked = changeEvent.target.checked;
              setAllDay(isAllDayChecked);
              setStart(isAllDayChecked ? start.slice(0, 10) : `${start.slice(0, 10)}T09:00`);
              setEnd(isAllDayChecked ? end.slice(0, 10) : `${end.slice(0, 10)}T10:00`);
            }}
          />
          {t('Dia inteiro', 'All day')}
        </label>
        {!allDay && (
          <p>
            {t('Fuso horário:', 'Time zone:')}
            {props.timeZone ?? event.time.start.timeZone ?? 'UTC'}
          </p>
        )}
        <label htmlFor={`${id}-start`}>{t('Início', 'Start')}</label>
        <input
          id={`${id}-start`}
          type={allDay ? 'date' : 'datetime-local'}
          step={allDay ? undefined : 1}
          value={start}
          required
          onChange={(changeEvent) => setStart(changeEvent.target.value)}
        />
        <label htmlFor={`${id}-end`}>
          {allDay ? t('Último dia', 'Last day') : t('Término', 'End')}
        </label>
        <input
          id={`${id}-end`}
          type={allDay ? 'date' : 'datetime-local'}
          step={allDay ? undefined : 1}
          value={end}
          required
          onChange={(changeEvent) => setEnd(changeEvent.target.value)}
        />
        {scope === 'series' && (
          <>
            <label htmlFor={`${id}-repeat`}>{t('Repetir', 'Repeat')}</label>
            <select
              id={`${id}-repeat`}
              value={frequency}
              onChange={(changeEvent) => {
                setFrequency(changeEvent.target.value as Frequency | '');
                markRuleField('frequency');
              }}
            >
              <option value="">{t('Não repetir', 'Does not repeat')}</option>
              <option value="DAILY">{t('Diariamente', 'Daily')}</option>
              <option value="WEEKLY">{t('Semanalmente', 'Weekly')}</option>
              <option value="MONTHLY">{t('Mensalmente', 'Monthly')}</option>
              <option value="YEARLY">{t('Anualmente', 'Yearly')}</option>
            </select>
            {frequency && (
              <fieldset>
                <legend>{t('Configuração da repetição', 'Recurrence settings')}</legend>
                <label htmlFor={`${id}-repeat-interval`}>
                  {t('Intervalo da repetição', 'Recurrence interval')}
                </label>
                <input
                  id={`${id}-repeat-interval`}
                  type="number"
                  min={1}
                  step={1}
                  required
                  value={repeatInterval}
                  onChange={(changeEvent) => {
                    setRepeatInterval(changeEvent.target.value);
                    markRuleField('interval');
                  }}
                />
                <p>
                  {frequency === 'DAILY'
                    ? t('Em dias', 'In days')
                    : frequency === 'WEEKLY'
                      ? t('Em semanas', 'In weeks')
                      : frequency === 'MONTHLY'
                        ? t('Em meses', 'In months')
                        : t('Em anos', 'In years')}
                </p>
                {frequency === 'WEEKLY' && (
                  <fieldset className="mc-recurrence-weekdays">
                    <legend>{t('Dias da semana', 'Weekdays')}</legend>
                    {WEEKDAYS.map(([weekday, label], index) => (
                      <label className="mc-editor-check" key={weekday}>
                        <input
                          type="checkbox"
                          checked={repeatWeekdays.includes(weekday)}
                          onChange={(changeEvent) => {
                            setRepeatWeekdays(
                              changeEvent.target.checked
                                ? [...repeatWeekdays, weekday]
                                : repeatWeekdays.filter((day) => day !== weekday),
                            );
                            markRuleField('weekdays');
                          }}
                        />
                        {english
                          ? new Intl.DateTimeFormat('en-US', {
                              weekday: 'long',
                              timeZone: 'UTC',
                            }).format(new Date(Date.UTC(2026, 0, 5 + index)))
                          : label}
                      </label>
                    ))}
                  </fieldset>
                )}
                {usesMonthDay && (
                  <>
                    <label htmlFor={`${id}-repeat-day`}>
                      {t('Dia do mês da repetição', 'Recurring day of month')}
                    </label>
                    <input
                      id={`${id}-repeat-day`}
                      type="number"
                      min={-31}
                      max={31}
                      step={1}
                      required
                      value={repeatMonthDay}
                      onChange={(changeEvent) => {
                        setRepeatMonthDay(changeEvent.target.value);
                        markRuleField('monthDay');
                      }}
                    />
                    <p>
                      {t(
                        'Valores negativos contam a partir do fim do mês: -1 é o último dia.',
                        'Negative values count from the end of the month: -1 is the last day.',
                      )}
                    </p>
                  </>
                )}
                {frequency === 'YEARLY' && (
                  <>
                    <label htmlFor={`${id}-repeat-month`}>
                      {t('Mês da repetição', 'Recurring month')}
                    </label>
                    <select
                      id={`${id}-repeat-month`}
                      value={repeatMonth}
                      onChange={(changeEvent) => {
                        setRepeatMonth(changeEvent.target.value);
                        markRuleField('month');
                      }}
                    >
                      {MONTHS.map((month, index) => (
                        <option key={month} value={index + 1}>
                          {english
                            ? new Intl.DateTimeFormat('en-US', {
                                month: 'long',
                                timeZone: 'UTC',
                              }).format(new Date(Date.UTC(2026, index, 1)))
                            : month}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                <label htmlFor={`${id}-repeat-end`}>
                  {t('Fim da repetição', 'Recurrence end')}
                </label>
                <select
                  id={`${id}-repeat-end`}
                  value={repeatEnd}
                  onChange={(changeEvent) => {
                    setRepeatEnd(changeEvent.target.value as RecurrenceEnd);
                    markRuleField('end');
                  }}
                >
                  <option value="never">{t('Nunca', 'Never')}</option>
                  <option value="count">
                    {t('Após uma quantidade', 'After a number of occurrences')}
                  </option>
                  <option value="until">{t('Até uma data', 'Until a date')}</option>
                </select>
                {repeatEnd === 'count' && (
                  <>
                    <label htmlFor={`${id}-repeat-count`}>
                      {t('Quantidade de ocorrências', 'Number of occurrences')}
                    </label>
                    <input
                      id={`${id}-repeat-count`}
                      type="number"
                      min={1}
                      step={1}
                      required
                      value={repeatCount}
                      onChange={(changeEvent) => {
                        setRepeatCount(changeEvent.target.value);
                        markRuleField('end');
                      }}
                    />
                  </>
                )}
                {repeatEnd === 'until' && (
                  <>
                    <label htmlFor={`${id}-repeat-until`}>
                      {t('Data final da repetição', 'Last recurrence date')}
                    </label>
                    <input
                      id={`${id}-repeat-until`}
                      type="date"
                      required
                      value={repeatUntil}
                      onChange={(changeEvent) => {
                        setRepeatUntil(changeEvent.target.value);
                        markRuleField('end');
                      }}
                    />
                  </>
                )}
                {parsedRule && (
                  <p>
                    {t(
                      'As cláusulas avançadas da regra existente são preservadas até que o campo correspondente seja alterado.',
                      'Advanced clauses in the existing rule are preserved until their corresponding field changes.',
                    )}
                  </p>
                )}
              </fieldset>
            )}
          </>
        )}
        {!!props.resources?.length && (
          <fieldset>
            <legend>{t('Recursos', 'Resources')}</legend>
            {props.resources.map((resource) => (
              <label className="mc-editor-check" key={resource.id}>
                <input
                  type="checkbox"
                  checked={resourceIds.includes(resource.id)}
                  onChange={(changeEvent) =>
                    setResourceIds(
                      changeEvent.target.checked
                        ? [...resourceIds, resource.id]
                        : resourceIds.filter((resourceId) => resourceId !== resource.id),
                    )
                  }
                />
                {resource.title}
              </label>
            ))}
          </fieldset>
        )}
      </fieldset>
      {error && (
        <p id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
      <div className="mc-editor-actions">
        <button type="submit" disabled={pending || readOnly}>
          {pending ? t('Salvando…', 'Saving…') : t('Salvar evento', 'Save event')}
        </button>
        <button type="button" disabled={pending} onClick={props.onCancel}>
          {t('Cancelar', 'Cancel')}
        </button>
        {props.onDelete && (
          <button
            type="button"
            disabled={pending || readOnly}
            onClick={() => void persistEditorChanges(true)}
          >
            {t('Excluir evento', 'Delete event')}
          </button>
        )}
      </div>
    </form>
  );
}
