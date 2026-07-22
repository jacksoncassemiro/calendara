# Referência — Modelo de dados canônico e mapeamento (Google / Outlook / RFC 5545)

Define o **modelo canônico interno** da nossa lib e como ele traduz de/para Google e Outlook.
Princípio: **canônico = superconjunto expressivo baseado em RFC 5545**; Google é quase 1:1,
Outlook é um subconjunto estruturado conversível.

## Tipos canônicos (rascunho — vai para `packages/core/src/types`)

```ts
type WeekdayCode = 'MO'|'TU'|'WE'|'TH'|'FR'|'SA'|'SU';

interface EventDateTime {
  date?: string;      // 'YYYY-MM-DD'  (all-day)
  dateTime?: string;  // ISO 8601 c/ offset (timed)
  timeZone?: string;  // IANA, ex.: 'America/Sao_Paulo'
}

interface EventTime {
  allDay: boolean;
  start: EventDateTime;
  end: EventDateTime;  // all-day: EXCLUSIVO (convenção Google)
}

// Regra fiel ao RFC 5545 (mais rica que o protótipo — corrige o gap multi-ordinal)
interface RRuleModel {
  freq: 'DAILY'|'WEEKLY'|'MONTHLY'|'YEARLY';
  interval: number;                 // default 1
  count?: number;                   // COUNT
  until?: string;                   // UNTIL (data/datetime)
  byDay?: Array<{ weekday: WeekdayCode; ordinal?: number }>; // ← ordinal POR entrada (2FR, 4FR, -1MO)
  byMonthDay?: number[];            // pode ser negativo (-1 = último)
  byMonth?: number[];               // 1–12
  bySetPos?: number[];              // BYSETPOS
  weekStart?: WeekdayCode;          // WKST (default MO)
}

interface Recurrence {
  rule?: RRuleModel;                // ou string RRULE bruta em interop
  rDates?: string[];               // RDATE (datas adicionais)
  exDates?: string[];              // EXDATE (exceções removidas)
  overrides?: Record<string, Partial<CalendarEvent> | { cancelled: true }>;
  // ^ chave = originalStart (ISO) da ocorrência; permite mover/editar/cancelar UMA instância
}

interface CalendarEvent {
  id: string;
  calendarId: string;              // múltiplas agendas
  title: string;
  description?: string;
  time: EventTime;
  color?: string;                  // override; senão herda cor do calendar
  editable?: boolean;             // default true
  recurrence?: Recurrence;
  resourceIds?: string[];          // 0..N recursos que o evento ocupa (genérico)
  metadata?: Record<string, unknown>;
}

// Resource = conceito GENÉRICO e padrão de calendário (como FullCalendar/Syncfusion/Graph).
// A lib NÃO sabe o que um recurso "é". "profissional"/"sala"/"equipamento" são apenas VALORES
// que o app coloca em `type` (string opaca) — não são conceitos da biblioteca. Ver agenda-desvinculada.md.
interface CalendarResource {
  id: string;
  title: string;
  type?: string;                   // string OPACA definida pelo app (a lib não interpreta)
  color?: string;
  capacity?: number;               // lotação simultânea (default 1)
  bufferBefore?: number;           // minutos bloqueados antes (genérico)
  bufferAfter?: number;            // minutos bloqueados depois (genérico)
  businessHours?: BusinessHours[]; // disponibilidade própria do recurso
  parentId?: string;               // agrupamento hierárquico genérico
  order?: number;
  metadata?: Record<string, unknown>; // extensão livre do app (unidade, CBO, etc.) — a lib ignora
}
```

> **Regra de ouro (separação de responsabilidades):** a biblioteca só conhece `Resource` genérico,
> `capacity`, `buffer`, `businessHours` e `resourceIds`. **Toda** semântica de domínio — se um recurso é
> profissional, se é obrigatório num procedimento, qual recurso um exame exige — vive no **app consumidor**
> (via `metadata` e via os callbacks de validação/conflito). Nenhuma regra de negócio entra na lib.

> **Diferença crítica vs protótipo:** `byDay` guarda um **ordinal por entrada** (`{weekday, ordinal}`),
> em vez de um único `bySetPos` global. É o que permite "2ª e 4ª sexta" (`[{FR,2},{FR,4}]`) — o caso que
> o protótipo erra hoje (ver `recurrence-validation.md`).

## Mapeamento de campos

| Canônico | Google | Outlook (Graph) |
|---|---|---|
| `title` | `summary` | `subject` |
| `description` | `description` | `body.content` |
| `time.allDay` | `start.date` presente | `isAllDay` |
| `time.start/end` | `start/end {date\|dateTime,timeZone}` | `start/end {dateTime,timeZone}` (tz Windows) |
| `recurrence.rule` | linha `RRULE:` em `recurrence[]` | `recurrence.pattern` + `recurrence.range` |
| `recurrence.exDates` | linha `EXDATE:` | (exceções via `type:exception`) |
| `recurrence.rDates` | linha `RDATE:` | — (sem equivalente direto) |
| `recurrence.overrides` | instância c/ `recurringEventId`+`originalStartTime` / `status:cancelled` | `type:occurrence\|exception` + `seriesMasterId` |
| `color` | `colorId` / cor do calendar | `categories` / cor do calendar |
| `metadata.busy` | `transparency` (opaque/transparent) | `showAs` |

## Notas de interop
- **Timezone Outlook**: nomes Windows → precisa de mapa CLDR `windowsZones` (IANA↔Windows). Fase de integração.
- **all-day end exclusivo**: manter internamente; ao exibir "termina em", subtrair 1 dia.
- **Série vs instância**: internamente 1 `CalendarEvent` com `recurrence` = a série; a expansão gera
  **ocorrências virtuais** (não persistidas) e `overrides` aplica edições pontuais. Isso evita explodir
  o store com milhares de instâncias (padrão Google/Outlook: master + exceções).

## Bloqueios e horário comercial (não são "eventos")
Diferente do wsaude atual (que usa background events), no modelo canônico bloqueio e horário comercial
são **constraints/camadas próprias**, não `CalendarEvent`:
```ts
interface BusinessHours { daysOfWeek: number[]; startTime: string; endTime: string; start?: string; end?: string; }
interface DateRange { start: string; end: string; startTime?: string; endTime?: string; }
interface Blocking { scope: 'day'|'time'; date: string; start?: string; end?: string; description?: string; }
```
Renderizados como camada de fundo pelo core, e consultados pelo `ConstraintEngine` nas interações.
