import type { CalendarEvent, EventOccurrence } from '../types/event.js';

/** Active pointer gesture.
 * @remarks Português: Gesto ativo do ponteiro.
 */
export type InteractionKind = 'move' | 'resize' | 'select';

/** Resize endpoint; the default is end.
 * @remarks Português: Extremo do redimensionamento; o padrão é end.
 */
export type ResizeEdge = 'start' | 'end';

/** Availability or resource-occupancy result for a gesture preview.
 * @remarks Português: Resultado de disponibilidade ou ocupação do recurso na prévia do gesto.
 */
export type DraftReason =
  | 'ok'
  | 'blocked'
  | 'outside-business-hours'
  | 'outside-allowed'
  | 'over-capacity'
  | 'buffer-conflict';

/** Pointer destination in calendar dates and minutes of the day.
 * @remarks Português: Destino do ponteiro como data do calendário e minutos do dia.
 */
export interface PointerSlot {
  /** Change only the date while retaining the event clock time.
   * @remarks Português: Altera somente a data, preservando o horário do evento.
   */
  dateOnly?: boolean;
  /** Calendar date in YYYY-MM-DD format.
   * @remarks Português: Data do calendário em YYYY-MM-DD.
   */
  dateISO: string;
  /** Pointer or start position in minutes since midnight.
   * @remarks Português: Posição do ponteiro ou início em minutos desde meia-noite.
   */
  minuteOfDay: number;
  /** Whether the interval occupies whole calendar days.
   * @remarks Português: Indica se o intervalo ocupa dias inteiros do calendário.
   */
  allDay?: boolean;

  /** Resource of this placement; omitted for date-only views.
   * @remarks Português: Recurso desta posição; ausente em views somente de datas.
   */
  resourceId?: string;
}

/** Visible time limits in minutes of the day.
 * @remarks Português: Limites visíveis em minutos do dia.
 */
export interface GridBounds {
  /** Inclusive start in minutes relative to the day.
   * @remarks Português: Início inclusivo em minutos relativos ao dia.
   */
  startMin: number;
  /** Exclusive end in minutes relative to the day.
   * @remarks Português: Fim exclusivo em minutos relativos ao dia.
   */
  endMin: number;
}

/** Original event placement used to begin a move or resize.
 * @remarks Português: Posição original do evento usada para iniciar movimento ou redimensionamento.
 */
export interface PlacementInfo {
  /** Source is outside the store and uses the external commit callback.
   * @remarks Português: Origem externa ao estado, gravada pelo callback de entrada externa.
   */
  external?: boolean;

  /** Stable placement key combining master ID and original start.
   * @remarks Português: Chave estável da posição que combina ID do mestre e início original.
   */
  eventId: string;
  /** Calendar date in YYYY-MM-DD format.
   * @remarks Português: Data do calendário em YYYY-MM-DD.
   */
  dateISO: string;
  /** Inclusive start in minutes relative to the day.
   * @remarks Português: Início inclusivo em minutos relativos ao dia.
   */
  startMin: number;
  /** Exclusive end in minutes relative to the day.
   * @remarks Português: Fim exclusivo em minutos relativos ao dia.
   */
  endMin: number;
  /** End date; exclusive for all-day intervals.
   * @remarks Português: Data final; exclusiva em intervalos de dia inteiro.
   */
  endDateISO?: string;
  /** Whether the interval occupies whole calendar days.
   * @remarks Português: Indica se o intervalo ocupa dias inteiros do calendário.
   */
  allDay?: boolean;
  /** Full event duration in minutes, including multiday spans.
   * @remarks Português: Duração completa em minutos, incluindo períodos de vários dias.
   */
  durationMinutes?: number;
  /** Expanded occurrence retaining its original identity.
   * @remarks Português: Ocorrência expandida com identidade original preservada.
   */
  occurrence: EventOccurrence;

  /** Whether the source event allows movement or resizing.
   * @remarks Português: Indica se o evento de origem permite mover ou redimensionar.
   */
  editable: boolean;

  /** Resource of this placement; omitted for date-only views.
   * @remarks Português: Recurso desta posição; ausente em views somente de datas.
   */
  resourceId?: string;
}

/** Pointer destination independent of capture on the original event.
 * @remarks Português: Destino do ponteiro independente da captura no evento original.
 */
export interface OutsideDropTarget {
  /** Horizontal viewport pointer coordinate in CSS pixels.
   * @remarks Português: Coordenada horizontal do ponteiro na janela em pixels CSS.
   */
  clientX: number;
  /** Vertical viewport pointer coordinate in CSS pixels.
   * @remarks Português: Coordenada vertical do ponteiro na janela em pixels CSS.
   */
  clientY: number;
  /** Element at the destination; null when outside the document.
   * @remarks Português: Elemento no destino; null fora do documento.
   */
  target: Element | null;
}

/** Proposed calendar interval and optional target resource.
 * @remarks Português: Intervalo proposto no calendário e recurso de destino opcional.
 */
export interface DraftGeometry {
  /** Calendar date in YYYY-MM-DD format.
   * @remarks Português: Data do calendário em YYYY-MM-DD.
   */
  dateISO: string;
  /** Inclusive start in minutes relative to the day.
   * @remarks Português: Início inclusivo em minutos relativos ao dia.
   */
  startMin: number;
  /** Exclusive end in minutes relative to the day.
   * @remarks Português: Fim exclusivo em minutos relativos ao dia.
   */
  endMin: number;

  /** End date; exclusive for all-day intervals.
   * @remarks Português: Data final; exclusiva em intervalos de dia inteiro.
   */
  endDateISO?: string;
  /** Whether the interval occupies whole calendar days.
   * @remarks Português: Indica se o intervalo ocupa dias inteiros do calendário.
   */
  allDay?: boolean;

  /** Resource of this placement; omitted for date-only views.
   * @remarks Português: Recurso desta posição; ausente em views somente de datas.
   */
  resourceId?: string;
}

/** Gesture preview with its availability result.
 * @remarks Português: Prévia do gesto com seu resultado de disponibilidade.
 */
export interface InteractionDraft extends DraftGeometry {
  /** Title displayed for an external event preview.
   * @remarks Português: Título exibido na prévia de evento externo.
   */
  title?: string;
  /** Optional CSS accent for the event preview.
   * @remarks Português: Cor CSS opcional de destaque da prévia do evento.
   */
  color?: string;
  /** Gesture that produced this interval.
   * @remarks Português: Gesto que produziu este intervalo.
   */
  kind: InteractionKind;

  /** Whether the proposed interval satisfies validation.
   * @remarks Português: Indica se o intervalo proposto atende à validação.
   */
  valid: boolean;

  /** Availability or occupancy validation result.
   * @remarks Português: Resultado da validação de disponibilidade ou ocupação.
   */
  reason: DraftReason;

  /** Stable placement key combining master ID and original start.
   * @remarks Português: Chave estável da posição que combina ID do mestre e início original.
   */
  eventId?: string;
}

/** Proposed event change delivered to consumer persistence.
 * @remarks Português: Alteração proposta do evento entregue à persistência do consumidor.
 */
export interface EventChange {
  /** Gesture that produced this interval.
   * @remarks Português: Gesto que produziu este intervalo.
   */
  kind: 'move' | 'resize';
  /** Expanded occurrence retaining its original identity.
   * @remarks Português: Ocorrência expandida com identidade original preservada.
   */
  occurrence: EventOccurrence;
  /** Effective event associated with the proposed change.
   * @remarks Português: Evento efetivo associado à alteração proposta.
   */
  event: CalendarEvent;
  /** Calendar date in YYYY-MM-DD format.
   * @remarks Português: Data do calendário em YYYY-MM-DD.
   */
  dateISO: string;
  /** Inclusive start in minutes relative to the day.
   * @remarks Português: Início inclusivo em minutos relativos ao dia.
   */
  startMin: number;
  /** Exclusive end in minutes relative to the day.
   * @remarks Português: Fim exclusivo em minutos relativos ao dia.
   */
  endMin: number;
  /** End date; exclusive for all-day intervals.
   * @remarks Português: Data final; exclusiva em intervalos de dia inteiro.
   */
  endDateISO?: string;
  /** Whether the interval occupies whole calendar days.
   * @remarks Português: Indica se o intervalo ocupa dias inteiros do calendário.
   */
  allDay?: boolean;

  /** New inclusive local ISO start in the display timezone.
   * @remarks Português: Novo início local ISO inclusivo no fuso de exibição.
   */
  startDateTime: string;

  /** New exclusive local ISO end in the display timezone.
   * @remarks Português: Novo fim local ISO exclusivo no fuso de exibição.
   */
  endDateTime: string;

  /** IANA zone of the proposed local date/time endpoints.
   * @remarks Português: Fuso IANA dos extremos locais propostos.
   */
  timeZone?: string;

  /** Resource of this placement; omitted for date-only views.
   * @remarks Português: Recurso desta posição; ausente em views somente de datas.
   */
  resourceId?: string;

  /** Original resource of the grabbed event placement.
   * @remarks Português: Recurso original da posição do evento arrastado.
   */
  fromResourceId?: string;
}

/** Selected interval in an empty calendar area.
 * @remarks Português: Intervalo selecionado em uma área vazia do calendário.
 */
export interface SelectionChange {
  /** Calendar date in YYYY-MM-DD format.
   * @remarks Português: Data do calendário em YYYY-MM-DD.
   */
  dateISO: string;
  /** Inclusive start in minutes relative to the day.
   * @remarks Português: Início inclusivo em minutos relativos ao dia.
   */
  startMin: number;
  /** Exclusive end in minutes relative to the day.
   * @remarks Português: Fim exclusivo em minutos relativos ao dia.
   */
  endMin: number;
  /** End date; exclusive for all-day intervals.
   * @remarks Português: Data final; exclusiva em intervalos de dia inteiro.
   */
  endDateISO?: string;
  /** Whether the interval occupies whole calendar days.
   * @remarks Português: Indica se o intervalo ocupa dias inteiros do calendário.
   */
  allDay?: boolean;

  /** Resource of this placement; omitted for date-only views.
   * @remarks Português: Recurso desta posição; ausente em views somente de datas.
   */
  resourceId?: string;
}

/** Rejected gesture and its availability or occupancy reason.
 * @remarks Português: Gesto recusado e motivo de disponibilidade ou ocupação.
 */
export interface BlockedInfo {
  /** Gesture that produced this interval.
   * @remarks Português: Gesto que produziu este intervalo.
   */
  kind: InteractionKind;
  /** Calendar date in YYYY-MM-DD format.
   * @remarks Português: Data do calendário em YYYY-MM-DD.
   */
  dateISO: string;
  /** Inclusive start in minutes relative to the day.
   * @remarks Português: Início inclusivo em minutos relativos ao dia.
   */
  startMin: number;
  /** Exclusive end in minutes relative to the day.
   * @remarks Português: Fim exclusivo em minutos relativos ao dia.
   */
  endMin: number;
  /** End date; exclusive for all-day intervals.
   * @remarks Português: Data final; exclusiva em intervalos de dia inteiro.
   */
  endDateISO?: string;
  /** Whether the interval occupies whole calendar days.
   * @remarks Português: Indica se o intervalo ocupa dias inteiros do calendário.
   */
  allDay?: boolean;
  /** Availability or occupancy validation result.
   * @remarks Português: Resultado da validação de disponibilidade ou ocupação.
   */
  reason: DraftReason;

  /** Expanded occurrence retaining its original identity.
   * @remarks Português: Ocorrência expandida com identidade original preservada.
   */
  occurrence?: EventOccurrence;

  /** Resource of this placement; omitted for date-only views.
   * @remarks Português: Recurso desta posição; ausente em views somente de datas.
   */
  resourceId?: string;
}

/** Commit callback result; false or rejection requests rollback.
 * @remarks Português: Resultado do callback de gravação; false ou rejeição solicita reversão.
 */
export type CommitResult = void | boolean | Promise<void | boolean>;

/** Date-shift parameters. @remarks Português: Parâmetros de deslocamento da data. */
export interface ShiftCalendarDateInput {
  /** Calendar date, YYYY-MM-DD. @remarks Português: Data do calendário, YYYY-MM-DD. */
  dateISO: string;
  /** Signed number of days to move. @remarks Português: Número de dias a deslocar, com sinal. */
  days: number;
}

/** Shift a civil date by signed days. @remarks Português: Desloca uma data civil pelo número de dias com sinal. */
export function shiftCalendarDate({ dateISO, days }: ShiftCalendarDateInput): string {
  const [year, month, day] = dateISO.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year!, month! - 1, day! + days);
  return date.toISOString().slice(0, 10);
}

/** Signed number of calendar days from the first ISO date to the second.
 * @remarks Português: Quantidade de dias, com sinal, da primeira data ISO até a segunda.
 */
export function calendarDayOffset(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

/** Date and relative-minute parameters. @remarks Português: Parâmetros de data e minutos relativos. */
export interface NormalizeCalendarMinuteInput {
  /** Starting date, YYYY-MM-DD. @remarks Português: Data inicial, YYYY-MM-DD. */
  dateISO: string;
  /** Minutes relative to the starting date, including adjacent days. @remarks Português: Minutos relativos à data inicial, incluindo dias adjacentes. */
  minute: number;
}

/** Normalize adjacent-day minutes into a date and minute of day. @remarks Português: Normaliza minutos de dias adjacentes para data e minuto do dia. */
export function normalizeCalendarMinute({ dateISO, minute }: NormalizeCalendarMinuteInput): {
  dateISO: string;
  minute: number;
} {
  const days = Math.floor(minute / 1440);
  return { dateISO: shiftCalendarDate({ dateISO, days }), minute: minute - days * 1440 };
}

/** Wall-clock conversion parameters. @remarks Português: Parâmetros de conversão do horário local. */
export interface MinutesToDateTimeInput {
  /** Calendar date, YYYY-MM-DD. @remarks Português: Data do calendário, YYYY-MM-DD. */
  dateISO: string;
  /** Minutes since midnight, clamped to 0–1440. @remarks Português: Minutos desde meia-noite, limitados a 0–1440. */
  minuteOfDay: number;
}

/** Format local ISO date-time from minutes. @remarks Português: Formata data e horário ISO locais a partir dos minutos. */
export function minutesToDateTime({ dateISO, minuteOfDay }: MinutesToDateTimeInput): string {
  const clampedMinute = Math.max(0, Math.min(Math.floor(minuteOfDay), 24 * 60));
  const isNextDay = clampedMinute === 24 * 60;
  if (isNextDay) {
    const [year, month, day] = dateISO.split('-').map(Number);
    const nextDay = new Date(0);
    nextDay.setUTCFullYear(year!, month! - 1, day! + 1);
    return `${nextDay.toISOString().slice(0, 10)}T00:00:00`;
  }
  const hours = Math.floor(clampedMinute / 60);
  const minutes = clampedMinute % 60;
  const pad = (value: number): string => (value < 10 ? `0${value}` : `${value}`);
  return `${dateISO}T${pad(hours)}:${pad(minutes)}:00`;
}

/** Named inputs for reassignResource.
 * @remarks Português: Entradas nomeadas de reassignResource.
 */
export interface ReassignResourceInput {
  /** Current resource assignments.
   * @remarks Português: Atribuições atuais de recursos.
   */
  resourceIds: readonly string[];
  /** Grabbed resource assignment to replace.
   * @remarks Português: Atribuição de recurso arrastada a substituir.
   */
  fromResourceId: string;
  /** Destination resource assignment.
   * @remarks Português: Atribuição de recurso de destino.
   */
  toResourceId: string;
}

/** Replace the grabbed resource while retaining other assignments and removing duplicates.
 * @remarks Português: Troca o recurso arrastado, preserva os demais e remove duplicações.
 */

export function reassignResource({
  resourceIds,
  fromResourceId,
  toResourceId,
}: ReassignResourceInput): string[] {
  const others = resourceIds.filter((id) => id !== fromResourceId && id !== toResourceId);
  return [...others, toResourceId];
}

/** Optimistic event-update parameters. @remarks Português: Parâmetros de atualização otimista do evento. */
export interface ApplyEventTimeChangeInput {
  /** Current immutable event collection. @remarks Português: Coleção imutável atual de eventos. */
  events: readonly CalendarEvent[];
  /** Validated move or resize proposal. @remarks Português: Proposta validada de movimento ou redimensionamento. */
  change: EventChange;
}

/** Apply a move or resize without mutating the event collection. @remarks Português: Aplica movimento ou redimensionamento sem alterar a coleção original. */
export function applyEventTimeChange({
  events,
  change,
}: ApplyEventTimeChangeInput): CalendarEvent[] {
  const masterId = change.occurrence.masterId;
  const { fromResourceId, resourceId } = change;
  const crossedResource =
    fromResourceId !== undefined && resourceId !== undefined && fromResourceId !== resourceId;
  return events.map((event) => {
    const isTargetMaster = event.id === masterId;
    if (!isTargetMaster) return event;
    const effective = change.occurrence.event;
    const nextTime = change.allDay
      ? {
          allDay: true,
          start: { date: change.dateISO },
          end: { date: change.endDateISO ?? change.endDateTime.slice(0, 10) },
        }
      : {
          ...effective.time,
          allDay: false,
          start: {
            ...(effective.time.allDay ? {} : effective.time.start),
            dateTime: change.startDateTime,
            ...(change.timeZone ? { timeZone: change.timeZone } : {}),
          },
          end: {
            ...(effective.time.allDay ? {} : effective.time.end),
            dateTime: change.endDateTime,
            ...(change.timeZone ? { timeZone: change.timeZone } : {}),
          },
        };
    const nextResources = crossedResource
      ? reassignResource({
          resourceIds: effective.resourceIds ?? [],
          fromResourceId: fromResourceId!,
          toResourceId: resourceId!,
        })
      : effective.resourceIds;
    if (event.recurrence) {
      const override = event.recurrence.overrides?.[change.occurrence.originalStart];
      return {
        ...event,
        recurrence: {
          ...event.recurrence,
          overrides: {
            ...event.recurrence.overrides,
            [change.occurrence.originalStart]: {
              ...override,
              time: nextTime,
              ...(nextResources ? { resourceIds: nextResources } : {}),
            },
          },
        },
      };
    }
    const next: CalendarEvent = {
      ...event,
      time: nextTime,
    };
    if (crossedResource) {
      next.resourceIds = reassignResource({
        resourceIds: event.resourceIds ?? [],
        fromResourceId: fromResourceId!,
        toResourceId: resourceId!,
      });
    }
    return next;
  });
}
