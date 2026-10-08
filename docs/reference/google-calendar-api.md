# Referência — Google Calendar API (modelo de dados)

Foco: **modelo de dados de evento** (sem auth/sync). Fonte: documentação oficial Google Workspace Calendar.

## Recurso `Event` (campos que nos interessam)

```jsonc
{
  "id": "abc123",
  "summary": "Reunião",                 // título
  "description": "…",
  "colorId": "5",                        // cor (paleta) — ou usamos cor do calendar
  "start": { "dateTime": "2015-09-15T06:00:00+02:00", "timeZone": "Europe/Zurich" },
  "end":   { "dateTime": "2015-09-15T07:00:00+02:00", "timeZone": "Europe/Zurich" },
  "recurrence": [                        // ARRAY de linhas RFC 5545
    "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;COUNT=12",
    "EXDATE;TZID=Europe/Zurich:20150918T060000",
    "RDATE;TZID=Europe/Zurich:20151010T060000"
  ],
  "recurringEventId": "abc123",          // presente em INSTÂNCIAS (aponta para o pai)
  "originalStartTime": { "dateTime": "…" }, // instância: horário original antes de mover
  "status": "confirmed | tentative | cancelled",
  "transparency": "opaque | transparent",   // opaque = ocupa tempo (busy)
  "attendees": [ … ]
}
```

### Regras de data/hora
- **Timed**: `start.dateTime` (ISO 8601 com offset) + `start.timeZone` (IANA).
- **All-day**: `start.date` = `YYYY-MM-DD`; **`end.date` é EXCLUSIVO** (um evento de 1 dia em 15/09 tem
  `end.date = 2015-09-16`). Nossa lib **já segue essa convenção** (herdada das tentativas anteriores).
- Para eventos **recorrentes**, **um timeZone único é obrigatório** — é ele que expande as ocorrências.
  Sem timeZone, cai para UTC e o horário "desliza" no horário de verão (DST). → nosso motor precisa
  expandir sempre com o timeZone da série (é o que o `TimezoneOffsetCache` faz).

### Modelo de recorrência
- `recurrence` = união de todas as linhas **RRULE** e **RDATE**, menos as **EXDATE**.
- Google guarda **evento-pai (com a regra) + instâncias geradas**. Ocorrências movidas/canceladas viram
  **exceções** (instância com `recurringEventId` e `originalStartTime`, ou `status:"cancelled"`).
- Consequência de design para nós: precisamos representar **(a)** a série (regra) e **(b)** overrides por
  ocorrência (mover/cancelar/editar uma instância). Ver `data-model-mapping.md`.

### Cores / múltiplos calendários
- Um `Event` pertence a um `calendarId`. `colorId` referencia uma paleta fixa; na prática a maioria dos
  apps usa a **cor do calendário**. Nosso modelo usa `calendarId` + `color` no evento (override opcional).

## Implicações para a nossa lib
- Nosso `EventTime` (`{allDay, start:{date|dateTime,timeZone}, end:{…}}`) já é **isomórfico** ao Google.
- `recurrence` como **array de strings RFC 5545** é o formato de interop de entrada/saída — nosso motor
  Temporal deve **parsear e serializar** RRULE/EXDATE/RDATE.
- Suportar **overrides por instância** (exceções) desde o modelo de dados.
