/** Calendar state and layout defaults.
 * @remarks Português: Estado de dados e padrões de layout do calendário.
 */
import type { WeekdayCode } from '../types/datetime.js';
import type { CalendarEvent } from '../types/event.js';
import type { ConstraintSet } from '../types/constraint.js';
import { hhmmToMinutes } from '../date/time.js';

/** Grid hour as a number, HH:mm or HH:mm:ss; seconds are ignored.
 * @remarks Português: Hora numérica ou HH:mm/HH:mm:ss, sem segundos; 24/24:00 representa o fim do
 * dia.
 */
export type GridHour = number | string;

/** Convert a grid endpoint to fractional hours.
 * @remarks Português: Converte o extremo para horas fracionárias: 07:30 vira 7,5.
 */
export function resolveHour(value: GridHour): number {
  return typeof value === 'string' ? hhmmToMinutes(value) / 60 : value;
}

/** Calendar behavior and time-axis layout options.
 * @remarks Português: Opções de comportamento e geometria do calendário.
 */
export interface CalendarOptions {
  /** Locale for date and time labels; default pt-BR.
   * @remarks Português: Idioma dos rótulos; padrão pt-BR.
   */
  locale: string;
  /** First weekday in week views; default MO.
   * @remarks Português: Primeiro dia da semana; padrão segunda-feira (MO).
   */
  weekStart: WeekdayCode;
  /** Visible grid start; default 6.
   * @remarks Português: Início visível: hora numérica ou HH:mm; padrão 06:00.
   */
  startHour: GridHour;
  /** Exclusive grid end; default 22.
   * @remarks Português: Fim exclusivo: hora numérica ou HH:mm; padrão 22:00.
   */
  endHour: GridHour;
  /** Grid and gesture step in minutes; default 30.
   * @remarks Português: Passo da grade e dos gestos em minutos; padrão 30.
   */
  slotMinutes: number;
  /** Scroll near viewport/container edges during drag; default true.
   * @remarks Português: Rola nas bordas durante o gesto; false desativa.
   */
  autoScroll?: boolean;
  /** Label interval in minutes; omitted adapts to scale.
   * @remarks Português: Intervalo dos rótulos em minutos; ausente adapta à escala, sem mudar o
   * snap.
   */
  timeLabelInterval?: number;
  /** Time-axis scale in pixels per minute; default 1.
   * @remarks Português: Escala do eixo de tempo em px por minuto; padrão 1.
   */
  pxPerMinute: number;
  /** IANA display zone; default America/Sao_Paulo.
   * @remarks Português: Fuso IANA de exibição; padrão America/Sao_Paulo.
   */
  timeZone: string;
  /** Injected current time in epoch milliseconds; null uses Date.now().
   * @remarks Português: Relógio em milissegundos desde epoch; null usa Date.now().
   */
  nowMs: number | null;
  /** Minimum visual and resize duration in minutes; default 15.
   * @remarks Português: Duração mínima visual e de redimensionamento em minutos; padrão 15.
   */
  minEventMinutes: number;
  /** Month cards per day; default 3, false shows all.
   * @remarks Português: Cartões por dia no mês; padrão 3, false exibe todos.
   */
  monthMaxEvents?: number | false;
  /** Registered view opened by month overflow; omitted uses a popover.
   * @remarks Português: View aberta por ver mais no mês; ausente usa popover.
   */
  monthMoreView?: string;
  /** Allow timed/all-day conversion while moving; default false.
   * @remarks Português: Permite converter horário/dia inteiro ao mover; padrão false.
   */
  allowEventTypeChange?: boolean;
  /** Inherited simultaneous resource capacity; default 1, false is unlimited.
   * @remarks Português: Capacidade herdada por recursos; padrão 1, false remove o limite.
   */
  defaultResourceCapacity?: number | false;
  /** Dense-event layout: shrink, scroll or more; default shrink.
   * @remarks Português: Eventos próximos: comprimir, rolar ou agrupar; padrão shrink.
   */
  timedEventOverflow?: 'shrink' | 'scroll' | 'more';
  /** Allow partial overlap in vertical timed views; default false.
   * @remarks Português: Sobreposição parcial nas grades verticais; padrão false.
   */
  slotEventOverlap?: boolean;
  /** Visible stack limit in more mode; minimum 2, default 3.
   * @remarks Português: Limite no modo more, incluindo ver mais; mínimo 2, padrão 3.
   */
  eventMaxStack?: number;
  /** Minimum event lane width in scroll mode, in pixels; default 100.
   * @remarks Português: Largura mínima da faixa no modo scroll em px; padrão 100.
   */
  minEventWidth?: number;
  /** Registered view opened by timed overflow; omitted uses a popover.
   * @remarks Português: View aberta por ver mais nas grades de horário; ausente usa popover.
   */
  eventMoreView?: string;
  /** Visible resource IDs; omitted shows all.
   * @remarks Português: IDs de recursos visíveis; ausente exibe todos.
   */
  visibleResourceIds?: readonly string[];
}

/** Immutable data snapshot of the calendar.
 * @remarks Português: Estado de dados do calendário; trate a consulta como imutável.
 */
export interface CalendarState {
  /** Reference date in YYYY-MM-DD format.
   * @remarks Português: Data de referência em YYYY-MM-DD.
   */
  date: string;
  /** Active registered view name.
   * @remarks Português: Nome da view registrada ativa.
   */
  viewName: string;
  /** Current immutable event collection.
   * @remarks Português: Coleção atual de eventos; trate os dados como imutáveis.
   */
  events: readonly CalendarEvent[];
  /** Current global availability rules.
   * @remarks Português: Regras gerais atuais de disponibilidade.
   */
  constraints: ConstraintSet;
  /** Resolved calendar options, including defaults.
   * @remarks Português: Opções resolvidas, incluindo os padrões.
   */
  options: CalendarOptions;
}

/** Default calendar behavior and display settings.
 * @remarks Português: Valores padrão de comportamento e exibição.
 */
export const DEFAULT_OPTIONS: CalendarOptions = {
  locale: 'pt-BR',
  weekStart: 'MO',
  startHour: 6,
  endHour: 22,
  slotMinutes: 30,
  pxPerMinute: 1,
  timeZone: 'America/Sao_Paulo',
  nowMs: null,
  minEventMinutes: 15,
  monthMaxEvents: 3,
  slotEventOverlap: false,
};

/** Reject invalid ranges, scales and density settings.
 * @remarks Português: Rejeita intervalos, escalas e limites inválidos antes da renderização.
 */
export function validateCalendarOptions(options: CalendarOptions): void {
  const validHour = (value: GridHour): boolean => {
    if (
      typeof value === 'string' &&
      !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$|^24:00(?::00)?$/.test(value)
    )
      return false;
    const hours = resolveHour(value);
    return Number.isFinite(hours) && hours >= 0 && hours <= 24;
  };
  const validRange =
    validHour(options.startHour) &&
    validHour(options.endHour) &&
    resolveHour(options.endHour) > resolveHour(options.startHour);
  if (!validRange)
    throw new RangeError(
      '[calendara] startHour/endHour devem formar um intervalo dentro de 00:00–24:00.',
    );
  const validSlot =
    Number.isFinite(options.slotMinutes) && options.slotMinutes > 0 && options.slotMinutes <= 1440;
  if (!validSlot)
    throw new RangeError('[calendara] slotMinutes deve ser maior que zero e no máximo 1440.');
  if (
    options.timeLabelInterval !== undefined &&
    (!Number.isFinite(options.timeLabelInterval) ||
      options.timeLabelInterval <= 0 ||
      options.timeLabelInterval > 1440)
  )
    throw new RangeError('[calendara] timeLabelInterval deve ser maior que zero e no máximo 1440.');
  if (
    options.timedEventOverflow !== undefined &&
    !['shrink', 'scroll', 'more'].includes(options.timedEventOverflow)
  )
    throw new RangeError('Invalid timedEventOverflow');
  if (
    options.eventMaxStack !== undefined &&
    (!Number.isInteger(options.eventMaxStack) || options.eventMaxStack < 2)
  )
    throw new RangeError('eventMaxStack must be an integer >= 2');
  if (
    options.minEventWidth !== undefined &&
    (!Number.isFinite(options.minEventWidth) || options.minEventWidth <= 0)
  )
    throw new RangeError('minEventWidth must be positive');
  if (
    options.defaultResourceCapacity !== undefined &&
    options.defaultResourceCapacity !== false &&
    (!Number.isSafeInteger(options.defaultResourceCapacity) || options.defaultResourceCapacity <= 0)
  )
    throw new RangeError('defaultResourceCapacity must be a positive integer or false');
  const validScale = Number.isFinite(options.pxPerMinute) && options.pxPerMinute > 0;
  if (!validScale) throw new RangeError('[calendara] pxPerMinute deve ser maior que zero.');
  const validMinimum =
    Number.isFinite(options.minEventMinutes) &&
    options.minEventMinutes > 0 &&
    options.minEventMinutes <= 1440;
  if (!validMinimum)
    throw new RangeError('[calendara] minEventMinutes deve estar entre zero e 1440.');
  if (
    options.monthMaxEvents !== undefined &&
    options.monthMaxEvents !== false &&
    (!Number.isInteger(options.monthMaxEvents) || options.monthMaxEvents < 0)
  ) {
    throw new RangeError('[calendara] monthMaxEvents deve ser um inteiro não negativo ou false.');
  }
}
