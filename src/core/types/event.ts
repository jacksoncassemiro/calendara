/** Canonical event and expanded-occurrence data.
 * @remarks Português: Dados canônicos de eventos e ocorrências expandidas.
 */
import type { EventTime } from './datetime.js';
import type { Recurrence } from './recurrence.js';

/** Canonical standalone event or recurring master.
 * @remarks Português: Evento avulso ou mestre recorrente.
 */
export interface CalendarEvent {
  /** Unique event or recurring-master ID.
   * @remarks Português: ID único do evento ou mestre recorrente.
   */
  id: string;
  /** Consumer calendar grouping ID.
   * @remarks Português: ID da agenda para agrupamento pelo consumidor.
   */
  calendarId: string;
  /** Event title shown by default renderers.
   * @remarks Português: Título exibido pelos renderizadores padrão.
   */
  title: string;
  /** Optional event description for consumer content.
   * @remarks Português: Descrição opcional para conteúdo do consumidor.
   */
  description?: string;
  /** Event endpoints and all-day mode.
   * @remarks Português: Extremos do evento e indicação de dia inteiro.
   */
  time: EventTime;
  /** CSS accent color; omitted uses theme styling.
   * @remarks Português: Cor CSS da faixa do evento; ausente usa o tema.
   */
  color?: string;
  /** Allow movement and resizing; default true.
   * @remarks Português: Permite mover e redimensionar; padrão true.
   */
  editable?: boolean;
  /** Recurrence rule, additions, exclusions and occurrence patches.
   * @remarks Português: Regra, datas extras, exclusões e alterações por ocorrência.
   */
  recurrence?: Recurrence;
  /** IDs of every resource occupied by the event.
   * @remarks Português: IDs de todos os recursos ocupados; cada um é validado.
   */
  resourceIds?: string[];
  /** Opaque consumer data.
   * @remarks Português: Dados livres, sem interpretação pela biblioteca.
   */
  metadata?: Record<string, unknown>;
}

/** Virtual occurrence with a stable original identity.
 * @remarks Português: Ocorrência virtual com identidade original preservada.
 */
export interface EventOccurrence {
  /** Effective event after applying an occurrence override.
   * @remarks Português: Evento efetivo após aplicar a alteração da ocorrência.
   */
  event: CalendarEvent;
  /** ID of the original recurring master or standalone event.
   * @remarks Português: ID do mestre original ou do evento avulso.
   */
  masterId: string;
  /** Original ISO start used to match overrides and exclusions.
   * @remarks Português: Início ISO original, preservado após mover para identificar a ocorrência.
   */
  originalStart: string;
  /** True for a standalone, non-recurring occurrence.
   * @remarks Português: True para uma ocorrência de evento avulso, sem recorrência.
   */
  isMaster: boolean;
}
