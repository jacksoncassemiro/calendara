/**
 * Resource = conceito GENÉRICO e padrão de calendário (como FullCalendar/Syncfusion/Graph).
 * A lib NÃO sabe o que um recurso "é". "profissional"/"sala"/"equipamento" são apenas VALORES
 * que o app coloca em `type` (string OPACA). Nenhuma regra de negócio entra na lib (ADR-006).
 * Ver docs/reference/agenda-desvinculada.md.
 */
import type { BusinessHours } from './constraint.js';

export interface CalendarResource {
  id: string;
  title: string;
  /** String OPACA definida pelo app — a lib não interpreta. */
  type?: string;
  color?: string;
  /** Lotação simultânea (default 1). */
  capacity?: number;
  /** Minutos bloqueados antes (genérico). */
  bufferBefore?: number;
  /** Minutos bloqueados depois (genérico). */
  bufferAfter?: number;
  /** Disponibilidade própria do recurso. */
  businessHours?: BusinessHours[];
  /** Agrupamento hierárquico genérico. */
  parentId?: string;
  order?: number;
  /** Extensão livre do app (unidade, CBO, etc.) — a lib ignora. */
  metadata?: Record<string, unknown>;
}
