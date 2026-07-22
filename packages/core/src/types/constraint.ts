/**
 * Bloqueios e horário comercial NÃO são "eventos" — são constraints/camadas próprias (ADR-005).
 * Renderizados como camada de fundo e consultados pelo ConstraintEngine nas interações.
 */

/** Horário comercial: janelas por dia da semana. `daysOfWeek` usa 0=domingo..6=sábado (convenção JS/FullCalendar). */
export interface BusinessHours {
  daysOfWeek: number[];
  /** 'HH:mm'. */
  startTime: string;
  /** 'HH:mm'. */
  endTime: string;
  /** Limite opcional de validade da regra ('YYYY-MM-DD'). */
  start?: string;
  end?: string;
}

/** Intervalo de datas permitido/considerado (allowedRanges). */
export interface DateRange {
  /** 'YYYY-MM-DD'. */
  start: string;
  /** 'YYYY-MM-DD'. */
  end: string;
  /** 'HH:mm' opcional. */
  startTime?: string;
  endTime?: string;
}

/** Bloqueio pontual: dia inteiro ou faixa de horário. */
export interface Blocking {
  scope: 'day' | 'time';
  /** 'YYYY-MM-DD'. */
  date: string;
  /** 'HH:mm' — obrigatório quando scope='time'. */
  start?: string;
  endTime?: string;
  end?: string;
  description?: string;
}

/** Conjunto de constraints aplicáveis a um calendário/recurso. */
export interface ConstraintSet {
  businessHours?: BusinessHours[];
  /** Se presente, só slots dentro destes ranges são válidos. */
  allowedRanges?: DateRange[];
  /** Slots que caem aqui são inválidos (tem precedência sobre tudo). */
  blocked?: Blocking[];
}

/** Resposta da avaliação de um slot. */
export interface SlotEvaluation {
  valid: boolean;
  reason?: 'blocked' | 'outside-business-hours' | 'outside-allowed' | 'ok';
}
