import type { EventOccurrence } from '../../../core/index.js';
import type { ViewRenderContext } from '../viewDef.js';

/** The interaction controller resolves the complete interval, including continuation days. */
export function occurrenceEditableForDay(
  occurrence: EventOccurrence,
  dayISO: string,
  context: ViewRenderContext,
): boolean {
  return occurrence.event.editable !== false && occurrenceDays(occurrence, context).includes(dayISO);
}

/** Visible dates intersecting the half-open event interval, in the display timezone. */
export function occurrenceDays(
  occurrence: EventOccurrence,
  context: ViewRenderContext,
): string[] {
  const { temporal, options, range } = context;
  const { time } = occurrence.event;
  if (time.allDay) {
    return range.days.map((day) => day.toString()).filter((iso) =>
      iso >= time.start.date! && iso < time.end.date!);
  }
  const start = temporal.PlainDateTime.from(time.start.dateTime!)
    .toZonedDateTime(time.start.timeZone ?? options.timeZone).epochMilliseconds;
  const end = temporal.PlainDateTime.from(time.end.dateTime!)
    .toZonedDateTime(time.end.timeZone ?? options.timeZone).epochMilliseconds;
  return range.days.filter((day) => {
    const dayStart = day.toZonedDateTime(options.timeZone).epochMilliseconds;
    const dayEnd = day.add({ days: 1 }).toZonedDateTime(options.timeZone).epochMilliseconds;
    return start < dayEnd && end > dayStart;
  }).map((day) => day.toString());
}

/** Resize handles only belong to the real, visible boundaries of the interval. */
export function occurrenceEdges(occurrence:EventOccurrence,dayISO:string,context:ViewRenderContext):{start:boolean;end:boolean} {
 const {time}=occurrence.event,{temporal,options}=context;
 if(time.allDay)return {start:time.start.date===dayISO,end:temporal.PlainDate.from(time.end.date!).subtract({days:1}).toString()===dayISO};
 const start=temporal.PlainDateTime.from(time.start.dateTime!).toZonedDateTime(time.start.timeZone ?? options.timeZone).withTimeZone(options.timeZone);
 const end=temporal.PlainDateTime.from(time.end.dateTime!).toZonedDateTime(time.end.timeZone ?? options.timeZone).withTimeZone(options.timeZone);
 const min=typeof options.startHour==='number'?options.startHour*60:Number(options.startHour.slice(0,2))*60+Number(options.startHour.slice(3,5));
 const max=typeof options.endHour==='number'?options.endHour*60:Number(options.endHour.slice(0,2))*60+Number(options.endHour.slice(3,5));
 return {start:start.toPlainDate().toString()===dayISO && start.hour*60+start.minute>=min,
   end:end.toPlainDate().toString()===dayISO && end.hour*60+end.minute<=max || end.hour===0 && end.minute===0 && end.toPlainDate().subtract({days:1}).toString()===dayISO && max===1440};
}
