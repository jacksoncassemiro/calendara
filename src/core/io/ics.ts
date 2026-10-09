import type { TemporalLike } from '../date/temporal.js';
import type { CalendarEvent, EventDateTime, EventTime } from '../types/index.js';
import { isCancelledOverride } from '../types/index.js';
import { parseRRule, serializeRRule } from '../recurrence/parser.js';

/** Report a value omitted or requiring consumer support. @remarks Português: Relata valor omitido ou que exige suporte do consumidor. */
export interface ICalendarDiagnostic {
  /** Property or component name. @remarks Português: Nome da propriedade ou componente. */
  property: string;
  /** Explanation in English. @remarks Português: Explicação em inglês. */
  message: string;
  /** Related UID when available. @remarks Português: UID relacionado quando disponível. */
  uid?: string;
}

/** Strict VEVENT import input. @remarks Português: Entrada de importação estrita de VEVENT. */
export interface ImportICalendarInput {
  /** ICS text; maximum 5 MiB of UTF-16 code units. @remarks Português: Texto ICS; máximo de 5 MiB em unidades UTF-16. */
  text: string;
  /** Consumer calendar ID assigned to all events. @remarks Português: ID da agenda atribuído a todos os eventos. */
  calendarId: string;
  /** Resolved date implementation. @remarks Português: Implementação de datas resolvida. */
  temporal: TemporalLike;
}

/** Imported masters plus explicit omissions. @remarks Português: Mestres importados e omissões explícitas. */
export interface ImportICalendarResult {
  /** Standalone events and recurring masters. @remarks Português: Eventos avulsos e mestres recorrentes. */
  events: CalendarEvent[];
  /** Transport metadata not represented in CalendarEvent. @remarks Português: Metadados de transporte sem representação em CalendarEvent. */
  diagnostics: ICalendarDiagnostic[];
}

/** VEVENT export input. @remarks Português: Entrada de exportação de VEVENT. */
export interface ExportICalendarInput {
  /** Events with unique IDs used as UIDs. @remarks Português: Eventos com IDs únicos usados como UIDs. */
  events: readonly CalendarEvent[];
  /** Resolved date implementation. @remarks Português: Implementação de datas resolvida. */
  temporal: TemporalLike;
  /** UTC ISO timestamp; required for deterministic output. @remarks Português: Timestamp ISO UTC; obrigatório para saída determinística. */
  timestamp: string;
}

/** Exported text and explicit limitations. @remarks Português: Texto exportado e limitações explícitas. */
export interface ExportICalendarResult {
  /** CRLF text with UTF-8 lines folded at 75 octets. @remarks Português: Texto CRLF com linhas UTF-8 dobradas em 75 octetos. */
  text: string;
  /** Unmapped fields and IANA zone requirements. @remarks Português: Campos não mapeados e requisitos de fusos IANA. */
  diagnostics: ICalendarDiagnostic[];
}

interface Property {
  name: string;
  params: Record<string, string>;
  value: string;
}

function fail(message: string): never {
  throw new RangeError(`[calendara] ICS: ${message}`);
}

function property(line: string): Property {
  const match = /^([A-Z0-9-]+)((?:;[A-Z0-9-]+=(?:"[^"\r\n]*"|[^:;\r\n]*))*):(.*)$/i.exec(line);
  if (!match) fail('invalid content line');
  const params: Record<string, string> = {};
  for (const entry of match[2]!.matchAll(/;([A-Z0-9-]+)=("[^"]*"|[^;]*)/gi)) {
    const key = entry[1]!.toUpperCase();
    if (Object.hasOwn(params, key)) fail(`duplicate parameter ${key}`);
    params[key] = entry[2]!.replace(/^"|"$/g, '');
  }
  return { name: match[1]!.toUpperCase(), params, value: match[3]! };
}

function unescapeText(value: string): string {
  return value.replace(/\\([\s\S])|\\$/g, (_, character: string | undefined) => {
    if (!character || !/[nN,;\\]/.test(character)) fail('unsupported TEXT escape');
    return /[nN]/.test(character) ? '\n' : character;
  });
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function endpoint(entry: Property, temporal: TemporalLike): EventDateTime {
  for (const key of Object.keys(entry.params))
    if (key !== 'TZID' && key !== 'VALUE') fail(`unsupported ${entry.name} parameter ${key}`);
  const kind = entry.params.VALUE ?? 'DATE-TIME';
  if (kind === 'DATE') {
    if (entry.params.TZID || !/^\d{8}$/.test(entry.value)) fail(`invalid DATE in ${entry.name}`);
    const date = `${entry.value.slice(0, 4)}-${entry.value.slice(4, 6)}-${entry.value.slice(6, 8)}`;
    return { date: temporal.PlainDate.from(date).toString() };
  }
  if (kind !== 'DATE-TIME' || !/^\d{8}T\d{6}Z?$/.test(entry.value))
    fail(`unsupported ${entry.name} value`);
  if (entry.value.slice(13, 15) === '60') fail('leap seconds cannot be represented');
  const utc = entry.value.endsWith('Z');
  if (utc && entry.params.TZID) fail('UTC values cannot have TZID');
  const iso = `${entry.value.slice(0, 4)}-${entry.value.slice(4, 6)}-${entry.value.slice(6, 8)}T${entry.value.slice(9, 11)}:${entry.value.slice(11, 13)}:${entry.value.slice(13, 15)}`;
  const local = temporal.PlainDateTime.from(iso);
  const timeZone = utc ? 'UTC' : entry.params.TZID;
  if (timeZone) local.toZonedDateTime(timeZone);
  return { dateTime: local.toString(), ...(timeZone ? { timeZone } : {}) };
}

function sameShape(left: EventDateTime, right: EventDateTime): void {
  if (!!left.date !== !!right.date || left.timeZone !== right.timeZone)
    fail('endpoints/recurrence values must share value type and zone');
}

function validateTime(time: EventTime, temporal: TemporalLike): void {
  sameShape(time.start, time.end);
  if (time.allDay !== !!time.start.date) fail('allDay does not match endpoints');
  const comparison = time.allDay
    ? temporal.PlainDate.compare(time.start.date!, time.end.date!)
    : temporal.PlainDateTime.compare(time.start.dateTime!, time.end.dateTime!);
  if (comparison >= 0) fail('end must be after start; zero-duration events are unsupported');
}

function validateRule(rule: string, start: EventDateTime): void {
  const model = parseRRule(rule);
  if (model.until) {
    if (!!start.date !== (model.until.length === 10)) fail('UNTIL must match DTSTART value type');
    if (!start.date && !!start.timeZone !== model.until.endsWith('Z'))
      fail('UNTIL must be UTC for zoned events and local for floating events');
  }
}

/** Import a bounded ICS subset atomically; unsupported scheduling semantics throw.
 * @remarks Português: Importa subconjunto limitado de ICS atomicamente; semântica não suportada lança erro.
 */
export function importICalendar({
  text,
  calendarId,
  temporal,
}: ImportICalendarInput): ImportICalendarResult {
  if (text.length > 5 * 1024 * 1024) fail('input exceeds 5 MiB');
  const lines = text
    .replace(/^\uFEFF/, '')
    .replace(/\r?\n[ \t]/g, '')
    .split(/\r?\n/)
    .filter(Boolean);
  const components: Property[][] = [];
  const diagnostics: ICalendarDiagnostic[] = [];
  let calendar = false;
  let closed = false;
  let current: Property[] | undefined;
  let version = false;
  for (const line of lines) {
    const entry = property(line);
    if (entry.name === 'BEGIN') {
      if (entry.value === 'VCALENDAR' && !calendar && !closed) calendar = true;
      else if (entry.value === 'VEVENT' && calendar && !current) current = [];
      else fail(`unsupported or nested component ${entry.value}`);
    } else if (entry.name === 'END') {
      if (entry.value === 'VEVENT' && current) {
        components.push(current);
        current = undefined;
      } else if (entry.value === 'VCALENDAR' && calendar && !current) {
        calendar = false;
        closed = true;
      } else fail('unbalanced components');
    } else if (current) current.push(entry);
    else if (calendar) {
      if (entry.name === 'VERSION' && entry.value === '2.0' && !version) version = true;
      else if (
        entry.name === 'PRODID' ||
        (entry.name === 'CALSCALE' && entry.value === 'GREGORIAN')
      ) {
      } else fail(`unsupported calendar property ${entry.name}`);
    } else fail('property outside calendar');
  }
  if (!closed || calendar || current || !version) fail('incomplete VCALENDAR 2.0');
  const masters = new Map<string, CalendarEvent>();
  const exceptions: {
    uid: string;
    identity: EventDateTime;
    event?: CalendarEvent;
    cancelled: boolean;
    hasTitle?: boolean;
  }[] = [];
  for (const entries of components) {
    const grouped = new Map<string, Property[]>();
    for (const entry of entries)
      grouped.set(entry.name, [...(grouped.get(entry.name) ?? []), entry]);
    const one = (name: string): Property | undefined => {
      const values = grouped.get(name) ?? [];
      if (values.length > 1) fail(`duplicate ${name}`);
      return values[0];
    };
    const uidEntry = one('UID');
    if (!uidEntry?.value || Object.keys(uidEntry.params).length)
      fail('UID required without parameters');
    const uid = unescapeText(uidEntry.value);
    for (const entry of entries) {
      if (
        [
          'UID',
          'DTSTART',
          'DTEND',
          'SUMMARY',
          'DESCRIPTION',
          'RRULE',
          'RDATE',
          'EXDATE',
          'RECURRENCE-ID',
          'STATUS',
        ].includes(entry.name)
      )
        continue;
      if (['DTSTAMP', 'CREATED', 'LAST-MODIFIED', 'SEQUENCE'].includes(entry.name))
        diagnostics.push({
          uid,
          property: entry.name,
          message: 'Transport metadata is not retained.',
        });
      else fail(`unsupported event property ${entry.name}`);
    }
    for (const name of ['SUMMARY', 'DESCRIPTION', 'RRULE', 'STATUS']) {
      const entry = one(name);
      if (entry && Object.keys(entry.params).length) fail(`unsupported parameters on ${name}`);
    }
    const identityEntry = one('RECURRENCE-ID');
    const identity = identityEntry ? endpoint(identityEntry, temporal) : undefined;
    const status = one('STATUS')?.value;
    if (status && status !== 'CANCELLED') fail(`unsupported STATUS ${status}`);
    if (status === 'CANCELLED') {
      if (!identity) fail('cancelled master is unsupported');
      if (one('RRULE') || grouped.has('RDATE') || grouped.has('EXDATE'))
        fail('recurrence rules on overrides are unsupported');
      exceptions.push({ uid, identity, cancelled: true });
      continue;
    }
    const startEntry = one('DTSTART');
    if (!startEntry) fail('DTSTART required');
    const start = endpoint(startEntry, temporal);
    const endEntry = one('DTEND');
    const end = endEntry
      ? endpoint(endEntry, temporal)
      : start.date
        ? { date: temporal.PlainDate.from(start.date).add({ days: 1 }).toString() }
        : fail('timed events require DTEND');
    const time: EventTime = { allDay: !!start.date, start, end };
    validateTime(time, temporal);
    const event: CalendarEvent = {
      id: uid,
      calendarId,
      title: unescapeText(one('SUMMARY')?.value ?? ''),
      time,
    };
    const description = one('DESCRIPTION');
    if (description) event.description = unescapeText(description.value);
    const rule = one('RRULE');
    if (rule) {
      validateRule(rule.value, start);
      event.recurrence = { rule: parseRRule(rule.value) };
    }
    for (const [name, key] of [
      ['EXDATE', 'exDates'],
      ['RDATE', 'rDates'],
    ] as const) {
      const values = (grouped.get(name) ?? []).flatMap((entry) =>
        entry.value.split(',').map((value) => {
          const date = endpoint({ ...entry, value }, temporal);
          sameShape(start, date);
          return date.date ?? date.dateTime!;
        }),
      );
      if (values.length) event.recurrence = { ...event.recurrence, [key]: values };
    }
    if (event.recurrence?.rDates?.length && !event.recurrence.rule) {
      const anchor = start.date ?? start.dateTime!;
      event.recurrence.rDates = [...new Set([anchor, ...event.recurrence.rDates])];
    }
    if (identity) {
      if (event.recurrence) fail('recurrence rules on overrides are unsupported');
      exceptions.push({ uid, identity, event, cancelled: false, hasTitle: !!one('SUMMARY') });
    } else {
      if (masters.has(uid)) fail(`duplicate master UID ${uid}`);
      masters.set(uid, event);
    }
  }
  for (const exception of exceptions) {
    const master = masters.get(exception.uid);
    if (!master?.recurrence || (!master.recurrence.rule && !master.recurrence.rDates?.length))
      fail(`override without recurring master ${exception.uid}`);
    sameShape(master.time.start, exception.identity);
    const key = exception.identity.date ?? exception.identity.dateTime!;
    const overrides = (master.recurrence.overrides ??= {});
    if (Object.hasOwn(overrides, key)) fail('duplicate RECURRENCE-ID');
    overrides[key] = exception.cancelled
      ? { cancelled: true }
      : {
          ...(exception.hasTitle ? { title: exception.event!.title } : {}),
          ...(exception.event!.description !== undefined
            ? { description: exception.event!.description }
            : {}),
          time: exception.event!.time,
        };
  }
  return { events: [...masters.values()], diagnostics };
}

function dateProperty({
  name,
  date,
  temporal,
}: {
  name: string;
  date: EventDateTime;
  temporal: TemporalLike;
}): string {
  if (date.date) {
    if (date.timeZone || date.dateTime)
      fail('all-day zones or mixed endpoint fields cannot be exported');
    return `${name};VALUE=DATE:${temporal.PlainDate.from(date.date).toString().replace(/-/g, '')}`;
  }
  if (!date.dateTime || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(date.dateTime))
    fail('export requires local ISO timestamps with whole seconds');
  const local = temporal.PlainDateTime.from(date.dateTime);
  const value = local.toString({ smallestUnit: 'second' }).replace(/[-:]/g, '');
  const zone = date.timeZone;
  if (zone) {
    if (!/^[A-Za-z0-9_+./-]+$/.test(zone)) fail('unsupported TZID characters');
    local.toZonedDateTime(zone);
  }
  return `${name}${zone && zone !== 'UTC' ? `;TZID=${zone}` : ''}:${value}${zone === 'UTC' ? 'Z' : ''}`;
}

function fold(line: string): string {
  const encoder = new TextEncoder();
  let result = '';
  let octets = 0;
  for (const character of line) {
    const length = encoder.encode(character).length;
    if (octets + length > 75) {
      result += '\r\n ';
      octets = 1;
    }
    result += character;
    octets += length;
  }
  return result;
}

function originalTime({
  master,
  key,
  temporal,
}: {
  master: CalendarEvent;
  key: string;
  temporal: TemporalLike;
}): EventTime {
  const { start, end, allDay } = master.time;
  if (allDay) {
    const date = temporal.PlainDate.from(key);
    const duration = temporal.PlainDate.from(end.date!).since(temporal.PlainDate.from(start.date!));
    return {
      allDay,
      start: { date: date.toString() },
      end: { date: date.add(duration).toString() },
    };
  }
  const dateTime = temporal.PlainDateTime.from(key);
  const duration = temporal.PlainDateTime.from(end.dateTime!).since(
    temporal.PlainDateTime.from(start.dateTime!),
  );
  return {
    allDay,
    start: { ...start, dateTime: dateTime.toString() },
    end: { ...end, dateTime: dateTime.add(duration).toString() },
  };
}

/** Export supported events; IANA TZIDs require the receiving client's zone database.
 * @remarks Português: Exporta eventos suportados; TZIDs IANA exigem a base de fusos do cliente receptor.
 */
export function exportICalendar({
  events,
  temporal,
  timestamp,
}: ExportICalendarInput): ExportICalendarResult {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(timestamp))
    fail('timestamp must be UTC ISO with whole seconds');
  temporal.Instant.from(timestamp);
  const stamp = timestamp.replace(/[-:]/g, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Calendara//Calendar export//EN',
    'CALSCALE:GREGORIAN',
  ];
  const diagnostics: ICalendarDiagnostic[] = [];
  const ids = new Set<string>();
  const exportedZones = new Set<string>();
  const writeEvent = ({
    event,
    identity,
    cancelled = false,
  }: {
    event: CalendarEvent;
    identity?: EventDateTime;
    cancelled?: boolean;
  }) => {
    validateTime(event.time, temporal);
    const zone = event.time.start.timeZone;
    if (zone && zone !== 'UTC' && !exportedZones.has(zone)) {
      exportedZones.add(zone);
      diagnostics.push({
        uid: event.id,
        property: 'TZID',
        message:
          'IANA TZID is preserved without VTIMEZONE; receiving client must supply its zone database.',
      });
    }
    lines.push('BEGIN:VEVENT', `UID:${escapeText(event.id)}`, `DTSTAMP:${stamp}`);
    if (identity) lines.push(dateProperty({ name: 'RECURRENCE-ID', date: identity, temporal }));
    if (cancelled) lines.push('STATUS:CANCELLED');
    else
      lines.push(
        dateProperty({ name: 'DTSTART', date: event.time.start, temporal }),
        dateProperty({ name: 'DTEND', date: event.time.end, temporal }),
        `SUMMARY:${escapeText(event.title)}`,
      );
    if (!cancelled && event.description !== undefined)
      lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    if (!identity && event.recurrence) {
      const rule = event.recurrence.rule;
      if (rule) {
        const serialized = serializeRRule(typeof rule === 'string' ? parseRRule(rule) : rule);
        validateRule(serialized, event.time.start);
        if (typeof rule !== 'string' && rule.until && parseRRule(serialized).until !== rule.until)
          fail('UNTIL precision or offset cannot be preserved');
        lines.push(`RRULE:${serialized}`);
      }
      for (const [name, values] of [
        ['RDATE', event.recurrence.rDates],
        ['EXDATE', event.recurrence.exDates],
      ] as const)
        for (const value of values ?? [])
          lines.push(
            dateProperty({
              name,
              date: event.time.allDay ? { date: value } : { ...event.time.start, dateTime: value },
              temporal,
            }),
          );
    }
    lines.push('END:VEVENT');
  };
  for (const event of events) {
    if (!event.id || ids.has(event.id)) fail('event IDs must be nonempty and unique');
    ids.add(event.id);
    for (const field of ['calendarId', 'color', 'editable', 'resourceIds', 'metadata'] as const)
      if (event[field] !== undefined)
        diagnostics.push({
          uid: event.id,
          property: field,
          message: 'Consumer field is not exported.',
        });
    writeEvent({ event });
    for (const [key, override] of Object.entries(event.recurrence?.overrides ?? {})) {
      if (!event.recurrence?.rule && !event.recurrence?.rDates?.length)
        fail('override requires a recurrence set');
      const time = originalTime({ master: event, key, temporal });
      if (isCancelledOverride(override))
        writeEvent({ event: { ...event, time }, identity: time.start, cancelled: true });
      else {
        for (const field of Object.keys(override))
          if (!['title', 'description', 'time'].includes(field))
            fail(`unsupported override field ${field}`);
        writeEvent({
          event: { ...event, ...override, time: override.time ?? time },
          identity: time.start,
        });
      }
    }
  }
  lines.push('END:VCALENDAR');
  return { text: `${lines.map(fold).join('\r\n')}\r\n`, diagnostics };
}
