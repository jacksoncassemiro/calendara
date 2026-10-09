/** @jsxImportSource react */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
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

import {
  englishEditorMessages,
  portugueseEditorMessages,
  type CalendarEditorMessages,
} from './editorMessages.js';

const WEEKDAYS: readonly WeekdayCode[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const MONTH_NUMBERS = Array.from({ length: 12 }, (_, index) => index + 1);

type RecurrenceEnd = 'never' | 'count' | 'until';
type RecurrenceField = 'frequency' | 'interval' | 'end' | 'weekdays' | 'monthDay' | 'month';

/** Parse a positive integer or report the field error. @remarks Português: Converte inteiro positivo ou informa erro do campo. */
function parsePositiveInteger({
  value,
  label,
  errorTemplate,
}: {
  /** Raw form value. @remarks Português: Valor bruto do formulário. */
  value: string;
  /** Localized field name. @remarks Português: Nome traduzido do campo. */
  label: string;
  /** Error template with {field}. @remarks Português: Modelo do erro com {field}. */
  errorTemplate: string;
}): number {
  const parsedInteger = Number(value);
  if (!value.trim() || !Number.isSafeInteger(parsedInteger) || parsedInteger <= 0) {
    throw new Error(errorTemplate.replaceAll('{field}', label));
  }
  return parsedInteger;
}

/** Which repetitions an edit affects. @remarks Português: Quais repetições a edição afeta. */
export type CalendarEditScope = 'occurrence' | 'following' | 'series';
/** Identity and recurrence scope passed to editor callbacks. @remarks Português: Identidade e escopo de recorrência enviados aos callbacks. */
export interface CalendarEditorContext {
  /** Recurrence edit scope. @remarks Português: Escopo da edição de recorrência. */
  scope: CalendarEditScope;
  /** Original occurrence when editing a repetition. @remarks Português: Ocorrência original ao editar uma repetição. */
  occurrence?: EventOccurrence;
}
/** Optional editor setup and persistence callbacks. @remarks Português: Configuração do editor opcional e callbacks de persistência. */
export interface CalendarEventEditorProps {
  /** Initial draft; remount when switching events. @remarks Português: Rascunho inicial; remonte ao trocar de evento. */
  event: CalendarEvent;
  /** Original occurrence for identity and edit scope. @remarks Português: Ocorrência original para identidade e escopo. */
  occurrence?: EventOccurrence;
  /** Resources offered by the form. @remarks Português: Recursos disponíveis no formulário. */
  resources?: readonly CalendarResource[];
  /** Display time zone; defaults to the event zone, then UTC. @remarks Português: Fuso de exibição; padrão é o do evento, depois UTC. */
  timeZone?: string;
  /** Date locale and EN/PT text fallback; default pt-BR. Override text with messages.
   * @remarks Português: Locale de datas e fallback EN/PT; padrão pt-BR. Substitua textos com messages.
   */
  locale?: string;
  /** Override editor text; missing keys use the EN/PT locale fallback. @remarks Português: Substitui textos; chaves ausentes usam fallback EN/PT do locale. */
  messages?: Partial<CalendarEditorMessages>;
  /** Inject Temporal; otherwise resolved automatically. @remarks Português: Injeta Temporal; ausente resolve automaticamente. */
  temporal?: TemporalLike;
  /** Return an error before saving. @remarks Português: Retorna mensagem de erro antes de salvar. */
  validate?: (
    event: CalendarEvent,
    context: CalendarEditorContext,
  ) => string | undefined | Promise<string | undefined>;
  /** Persist the draft; false/rejection keeps the form open. @remarks Português: Persiste rascunho; false/rejeição mantém formulário aberto. */
  onSave: (
    event: CalendarEvent,
    context: CalendarEditorContext,
  ) => void | boolean | Promise<void | boolean>;
  /** Delete according to edit scope; false/rejection keeps it open. @remarks Português: Exclui conforme escopo; false/rejeição mantém aberto. */
  onDelete?: (
    event: CalendarEvent,
    context: CalendarEditorContext,
  ) => void | boolean | Promise<void | boolean>;
  /** Close without saving. @remarks Português: Fecha sem salvar. */
  onCancel: () => void;
}

function previousDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

/** Optional event form; remount with the occurrence key when switching events. @remarks Português: Formulário opcional; remonte usando a chave da ocorrência ao trocar de evento. */
export function CalendarEventEditor(props: CalendarEventEditorProps) {
  const { event } = props;
  const defaultMessages = props.locale?.toLowerCase().startsWith('en')
    ? englishEditorMessages
    : portugueseEditorMessages;
  const messages = useMemo(() => {
    const resolved = { ...defaultMessages };
    for (const key of Object.keys(defaultMessages) as (keyof CalendarEditorMessages)[]) {
      const override = props.messages?.[key];
      if (override !== undefined) resolved[key] = override;
    }
    return resolved;
  }, [defaultMessages, props.messages]);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const dateFormatters = useMemo(
    () => ({
      weekday: new Intl.DateTimeFormat(props.locale ?? 'pt-BR', {
        weekday: 'long',
        timeZone: 'UTC',
      }),
      month: new Intl.DateTimeFormat(props.locale ?? 'pt-BR', { month: 'long', timeZone: 'UTC' }),
    }),
    [props.locale],
  );
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
    WEEKDAYS[(new Date(`${initialDate}T00:00:00Z`).getUTCDay() + 6) % 7] ?? 'MO';
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
        const projectToCalendarTimeZone = ({
          dateTime,
          sourceZone,
        }: {
          /** Event local date-time. @remarks Português: Data e horário local do evento. */
          dateTime: string;
          /** Source zone; omitted uses the calendar zone. @remarks Português: Fuso de origem; ausente usa o fuso do calendário. */
          sourceZone: string | undefined;
        }) =>
          temporal.PlainDateTime.from(dateTime)
            .toZonedDateTime(sourceZone ?? calendarTimeZone)
            .withTimeZone(calendarTimeZone)
            .toPlainDateTime()
            .toString({ smallestUnit: 'second' });
        setStart(
          projectToCalendarTimeZone({
            dateTime: event.time.start.dateTime!,
            sourceZone: event.time.start.timeZone,
          }),
        );
        setEnd(
          projectToCalendarTimeZone({
            dateTime: event.time.end.dateTime!,
            sourceZone: event.time.end.timeZone,
          }),
        );
      })
      .catch(() => {
        if (active) setError(messagesRef.current.timeZoneLoadFailed);
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
          throw new Error(messages.deleteFailed);
        return;
      }
      if (!title.trim()) throw new Error(messages.titleRequired);
      const temporal = props.temporal ?? (await ensureTemporal());
      const calendarTimeZone = props.timeZone ?? event.time.start.timeZone ?? 'UTC';
      let time: CalendarEvent['time'];
      if (allDay) {
        const startDate = temporal.PlainDate.from(start);
        const endDate = temporal.PlainDate.from(end);
        if (temporal.PlainDate.compare(endDate, startDate) < 0)
          throw new Error(messages.lastDayInvalid);
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
          throw new Error(messages.endInvalid);
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
            rule.interval = parsePositiveInteger({
              value: repeatInterval,
              label: messages.intervalName,
              errorTemplate: messages.positiveIntegerError,
            });
          if (shouldUpdateRuleField('end')) {
            delete rule.count;
            delete rule.until;
            if (repeatEnd === 'count')
              rule.count = parsePositiveInteger({
                value: repeatCount,
                label: messages.countName,
                errorTemplate: messages.positiveIntegerError,
              });
            if (repeatEnd === 'until') {
              const endDate = temporal.PlainDate.from(repeatUntil);
              if (
                temporal.PlainDate.compare(endDate, temporal.PlainDate.from(start.slice(0, 10))) < 0
              )
                throw new Error(messages.recurrenceEndInvalid);
              rule.until = endDate.toString();
            }
          }
          if (frequency === 'WEEKLY' && shouldUpdateRuleField('weekdays')) {
            if (!repeatWeekdays.length) throw new Error(messages.weekdaysRequired);
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
              throw new Error(messages.monthDayInvalid);
            rule.byMonthDay = [day];
          }
          if (frequency === 'YEARLY' && shouldUpdateRuleField('month'))
            rule.byMonth = [
              parsePositiveInteger({
                value: repeatMonth,
                label: messages.monthName,
                errorTemplate: messages.positiveIntegerError,
              }),
            ];
          // Retain untouched advanced recurrence clauses. PT: Preserva cláusulas avançadas de recorrência não editadas.
          parseRRule(serializeRRule(rule));
          updated.recurrence = { ...event.recurrence, rule };
        } else delete updated.recurrence;
      }
      const updatedRule = updated.recurrence?.rule;
      const recurrenceModel =
        typeof updatedRule === 'string' ? parseRRule(updatedRule) : updatedRule;
      if (
        allDay &&
        recurrenceModel &&
        (['SECONDLY', 'MINUTELY', 'HOURLY'].includes(recurrenceModel.freq) ||
          recurrenceModel.byHour?.length ||
          recurrenceModel.byMinute?.length ||
          recurrenceModel.bySecond?.length)
      )
        throw new Error(messages.allDayRecurrenceInvalid);
      const validationError = await props.validate?.(updated, context);
      if (validationError) throw new Error(validationError);
      if ((await props.onSave(updated, context)) === false) throw new Error(messages.saveFailed);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : messages.actionFailed);
    } finally {
      busyRef.current = false;
      setPending(false);
    }
  };

  return (
    <form
      className="mc-event-editor"
      aria-label={messages.editEvent}
      aria-busy={pending}
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        void persistEditorChanges(false);
      }}
    >
      <fieldset disabled={pending || readOnly}>
        <legend>{messages.editAndReschedule}</legend>
        {readOnly && <p>{messages.readOnly}</p>}
        <label htmlFor={`${id}-title`}>{messages.title}</label>
        <input
          ref={titleRef}
          id={`${id}-title`}
          value={title}
          required
          onChange={(changeEvent) => setTitle(changeEvent.target.value)}
        />
        {recurring && (
          <>
            <label htmlFor={`${id}-scope`}>{messages.applyChanges}</label>
            <select
              id={`${id}-scope`}
              value={scope}
              onChange={(changeEvent) => setScope(changeEvent.target.value as CalendarEditScope)}
            >
              {props.occurrence && <option value="occurrence">{messages.onlyOccurrence}</option>}
              {props.occurrence && parsedRule && (
                <option value="following">{messages.followingOccurrences}</option>
              )}
              <option value="series">{messages.entireSeries}</option>
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
          {messages.allDay}
        </label>
        {!allDay && (
          <p>
            {messages.timeZone}
            {props.timeZone ?? event.time.start.timeZone ?? 'UTC'}
          </p>
        )}
        <label htmlFor={`${id}-start`}>{messages.start}</label>
        <input
          id={`${id}-start`}
          type={allDay ? 'date' : 'datetime-local'}
          step={allDay ? undefined : 1}
          value={start}
          required
          onChange={(changeEvent) => setStart(changeEvent.target.value)}
        />
        <label htmlFor={`${id}-end`}>{allDay ? messages.lastDay : messages.end}</label>
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
            <label htmlFor={`${id}-repeat`}>{messages.repeat}</label>
            <select
              id={`${id}-repeat`}
              value={frequency}
              onChange={(changeEvent) => {
                const selectedFrequency = changeEvent.target.value as Frequency | '';
                setFrequency(selectedFrequency);
                markRuleField('frequency');
                if (
                  ['SECONDLY', 'MINUTELY', 'HOURLY'].includes(selectedFrequency) &&
                  repeatEnd === 'never'
                ) {
                  setRepeatEnd('count');
                  markRuleField('end');
                }
              }}
            >
              <option value="">{messages.noRepeat}</option>
              <option value="SECONDLY" disabled={allDay}>
                {messages.secondly}
              </option>
              <option value="MINUTELY" disabled={allDay}>
                {messages.minutely}
              </option>
              <option value="HOURLY" disabled={allDay}>
                {messages.hourly}
              </option>
              <option value="DAILY">{messages.daily}</option>
              <option value="WEEKLY">{messages.weekly}</option>
              <option value="MONTHLY">{messages.monthly}</option>
              <option value="YEARLY">{messages.yearly}</option>
            </select>
            {frequency && (
              <fieldset>
                <legend>{messages.recurrenceSettings}</legend>
                <label htmlFor={`${id}-repeat-interval`}>{messages.recurrenceInterval}</label>
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
                  {frequency === 'SECONDLY'
                    ? messages.inSeconds
                    : frequency === 'MINUTELY'
                      ? messages.inMinutes
                      : frequency === 'HOURLY'
                        ? messages.inHours
                        : frequency === 'DAILY'
                          ? messages.inDays
                          : frequency === 'WEEKLY'
                            ? messages.inWeeks
                            : frequency === 'MONTHLY'
                              ? messages.inMonths
                              : messages.inYears}
                </p>
                {frequency === 'WEEKLY' && (
                  <fieldset className="mc-recurrence-weekdays">
                    <legend>{messages.weekdays}</legend>
                    {WEEKDAYS.map((weekday, index) => (
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
                        {dateFormatters.weekday.format(new Date(Date.UTC(2026, 0, 5 + index)))}
                      </label>
                    ))}
                  </fieldset>
                )}
                {usesMonthDay && (
                  <>
                    <label htmlFor={`${id}-repeat-day`}>{messages.recurringMonthDay}</label>
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
                    <p>{messages.negativeMonthDayHint}</p>
                  </>
                )}
                {frequency === 'YEARLY' && (
                  <>
                    <label htmlFor={`${id}-repeat-month`}>{messages.recurringMonth}</label>
                    <select
                      id={`${id}-repeat-month`}
                      value={repeatMonth}
                      onChange={(changeEvent) => {
                        setRepeatMonth(changeEvent.target.value);
                        markRuleField('month');
                      }}
                    >
                      {MONTH_NUMBERS.map((monthNumber) => (
                        <option key={monthNumber} value={monthNumber}>
                          {dateFormatters.month.format(
                            new Date(Date.UTC(2026, monthNumber - 1, 1)),
                          )}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                <label htmlFor={`${id}-repeat-end`}>{messages.recurrenceEnd}</label>
                <select
                  id={`${id}-repeat-end`}
                  value={repeatEnd}
                  onChange={(changeEvent) => {
                    setRepeatEnd(changeEvent.target.value as RecurrenceEnd);
                    markRuleField('end');
                  }}
                >
                  <option value="never">{messages.never}</option>
                  <option value="count">{messages.afterCount}</option>
                  <option value="until">{messages.untilDate}</option>
                </select>
                {repeatEnd === 'count' && (
                  <>
                    <label htmlFor={`${id}-repeat-count`}>{messages.occurrenceCount}</label>
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
                    <label htmlFor={`${id}-repeat-until`}>{messages.lastRecurrenceDate}</label>
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
                {parsedRule && <p>{messages.advancedRuleHint}</p>}
              </fieldset>
            )}
          </>
        )}
        {!!props.resources?.length && (
          <fieldset>
            <legend>{messages.resources}</legend>
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
          {pending ? messages.saving : messages.saveEvent}
        </button>
        <button type="button" disabled={pending} onClick={props.onCancel}>
          {messages.cancel}
        </button>
        {props.onDelete && (
          <button
            type="button"
            disabled={pending || readOnly}
            onClick={() => void persistEditorChanges(true)}
          >
            {messages.deleteEvent}
          </button>
        )}
      </div>
    </form>
  );
}
