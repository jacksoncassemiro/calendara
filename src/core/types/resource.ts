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
  /** Extend occupancy before each event; finite nonnegative minutes, default 0 (disabled).
   * @remarks Português: Acrescenta minutos de preparação à ocupação antes do evento,
   * finitos e não negativos; padrão 0 (desativado), respeitando a capacidade.
   */
  bufferBefore?: number;
  /** Extend occupancy after each event; finite nonnegative minutes, default 0 (disabled).
   * @remarks Português: Acrescenta minutos à ocupação depois do evento, respeitando a
   * capacidade; minutos finitos e não negativos, padrão 0 (desativado); pode alcançar o dia seguinte.
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
  /** Parent resource; enable hierarchy in resource timelines to render nesting.
   * @remarks Português: Recurso pai; habilite hierarchy na timeline de recursos para exibir a árvore.
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
