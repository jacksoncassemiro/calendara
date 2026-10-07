/**
 * Bloqueios e horário comercial NÃO são "eventos" — são constraints/camadas próprias (ADR-005).
 * Renderizados como camada de fundo e consultados pelo ConstraintEngine nas interações.
 *
 * CONVENÇÃO DE NOMES (uniforme em todo o módulo, para evitar ambiguidade):
 *   • `start` / `end`         → DATAS  'YYYY-MM-DD'
 *   • `startTime` / `endTime` → HORAS  'HH:mm'
 *   • `date`                  → UM dia 'YYYY-MM-DD'
 * Blocos reutilizáveis: `DateRangeBounds` (faixa de datas) e `TimeOfDayRange` (faixa de horário).
 */

/** Faixa de datas [start, end] — 'YYYY-MM-DD', inclusive. */
export interface DateRangeBounds {
  start: string;
  end: string;
}

/** Faixa de horário do dia [startTime, endTime] — 'HH:mm'. */
export interface TimeOfDayRange {
  startTime: string;
  endTime: string;
}

/**
 * Horário comercial: uma janela de horário (`TimeOfDayRange`) que vale em certos dias da semana,
 * com validade opcional por data (útil p/ expediente sazonal). `daysOfWeek` usa 0=domingo..6=sábado
 * (convenção JS/FullCalendar).
 */
export interface BusinessHours extends TimeOfDayRange {
  daysOfWeek: number[];
  /** Validade da regra (datas 'YYYY-MM-DD'): início inclusive. Ausente = sem limite inferior. */
  start?: string;
  /** Validade: fim inclusive. Ausente = sem limite superior. */
  end?: string;
}

/**
 * Faixa de datas permitida (allowedRanges): datas obrigatórias (`DateRangeBounds`) + uma janela
 * intradiária OPCIONAL. Se `allowedRanges` existe, só slots dentro dela são válidos.
 */
export interface DateRange extends DateRangeBounds {
  /** 'HH:mm' — limita também o horário dentro da faixa (opcional). */
  startTime?: string;
  /** 'HH:mm'. */
  endTime?: string;
}

/**
 * Bloqueio pontual: um dia inteiro (`scope: 'day'`) ou uma faixa de horário num dia
 * (`scope: 'time'`, usando `startTime`/`endTime`). Tem precedência sobre tudo.
 */
export interface Blocking {
  scope: 'day' | 'time';
  /** 'YYYY-MM-DD'. */
  date: string;
  /** 'HH:mm' — início da faixa bloqueada (scope 'time'). Ausente = começo do dia. */
  startTime?: string;
  /** 'HH:mm' — fim da faixa (exclusivo). Ausente = fim do dia. */
  endTime?: string;
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
