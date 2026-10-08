/**
 * Generic resource availability and occupancy configuration.
 * @remarks Português: Um recurso pode representar sala, profissional ou equipamento.
 * A biblioteca não interpreta type ou metadata como regras específicas de negócio.
 */
import type { BusinessHours, ConstraintSet } from './constraint.js';

/** Define a resource without prescribing its business meaning.
 * @remarks Português: Define disponibilidade e ocupação de um recurso; sua finalidade
 * pertence à aplicação consumidora.
 */
export interface CalendarResource {
  /** Unique resource identifier referenced by event.resourceIds.
   * @remarks Português: Identificador único usado em event.resourceIds.
   */
  id: string;
  /** Display name for resource headings.
   * @remarks Português: Nome exibido nos cabeçalhos de recurso.
   */
  title: string;
  /** Opaque resource category supplied by the consumer.
   * @remarks Português: Categoria definida pela aplicação, sem interpretação pela biblioteca.
   */
  type?: string;
  /** Optional resource color for consumer presentation.
   * @remarks Português: Cor disponível para apresentação; não altera disponibilidade ou capacidade.
   */
  color?: string;
  /** Override simultaneous capacity; undefined inherits the global default and false is unlimited.
   * @remarks Português: Um inteiro positivo limita a ocupação simultânea. Ausente herda
   * options.defaultResourceCapacity; false remove esse limite apenas para o recurso.
   */
  capacity?: number | false;
  /** Extend resource occupancy before each event, in minutes.
   * @remarks Português: Acrescenta minutos de preparação à ocupação antes do evento,
   * respeitando a capacidade configurada.
   */
  bufferBefore?: number;
  /** Extend resource occupancy after each event, in minutes.
   * @remarks Português: Acrescenta minutos à ocupação depois do evento, respeitando a
   * capacidade configurada e podendo alcançar o dia seguinte.
   */
  bufferAfter?: number;
  /** Restrict availability with resource-specific business hours.
   * @remarks Português: O expediente próprio restringe a disponibilidade sem remover as regras
   * gerais.
   */
  businessHours?: BusinessHours[];
  /** Apply additional resource constraints while retaining global rules.
   * @remarks Português: Acrescenta regras do recurso; as regras gerais continuam obrigatórias.
   */
  constraints?: ConstraintSet;
  /** Identify a parent resource for consumer-defined grouping.
   * @remarks Português: Identifica o recurso pai para agrupamento; o campo não cria sozinho
   * uma interface de expansão e recolhimento.
   */
  parentId?: string;
  /** Sort resources by ascending numeric order.
   * @remarks Português: Define a ordem numérica crescente de apresentação; ausente usa zero.
   */
  order?: number;
  /** Carry consumer metadata without adding calendar rules.
   * @remarks Português: Dados livres da aplicação; a biblioteca não os interpreta como regras.
   */
  metadata?: Record<string, unknown>;
}
