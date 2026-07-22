# Referência — Microsoft Graph / Outlook (modelo de dados)

Foco: **modelo de dados de evento** (sem auth/sync). Fonte: Microsoft Learn (Graph v1.0).
Diferença central vs Google: o Outlook **não usa RRULE**. Usa um objeto estruturado `patternedRecurrence`.

## Recurso `event` (campos relevantes)

```jsonc
{
  "id": "AAMk…",
  "subject": "Reunião",                 // título
  "body": { "contentType": "html", "content": "…" },
  "start": { "dateTime": "2017-04-15T12:00:00", "timeZone": "Pacific Standard Time" },
  "end":   { "dateTime": "2017-04-15T14:00:00", "timeZone": "Pacific Standard Time" },
  "isAllDay": false,
  "showAs": "busy | free | tentative | oof | workingElsewhere",
  "type": "singleInstance | occurrence | exception | seriesMaster",
  "seriesMasterId": "…",                 // presente em occurrence/exception
  "recurrence": { "pattern": {…}, "range": {…} }   // patternedRecurrence
}
```

> Atenção: o `timeZone` do Outlook usa **nomes Windows** ("Pacific Standard Time"), não IANA
> ("America/Los_Angeles"). Interop exige um **mapa Windows↔IANA** (biblioteca CLDR windowsZones).

## `patternedRecurrence` = `pattern` + `range`

### `recurrencePattern`
| campo | significado |
|---|---|
| `type` | `daily` \| `weekly` \| `absoluteMonthly` \| `relativeMonthly` \| `absoluteYearly` \| `relativeYearly` |
| `interval` | intervalo (dias/semanas/meses/anos) |
| `daysOfWeek` | ex.: `["monday","wednesday"]` (weekly e relative*) |
| `dayOfMonth` | dia fixo (absoluteMonthly/absoluteYearly) |
| `index` | `first \| second \| third \| fourth \| last` (relative*) |
| `month` | 1–12 (yearly) |
| `firstDayOfWeek` | equivalente ao **WKST** do RFC (default `sunday` no Outlook!) |

### `recurrenceRange`
| campo | significado |
|---|---|
| `type` | `endDate` \| `noEnd` \| `numbered` |
| `startDate` | início da série (`YYYY-MM-DD`) |
| `endDate` | fim (quando `endDate`) |
| `numberOfOccurrences` | qtde (quando `numbered`) → equivale a `COUNT` |
| `recurrenceTimeZone` | timeZone da série (opcional; senão usa o do evento) |

## Mapa mental Outlook → RFC 5545 (RRULE)
| Outlook | RRULE equivalente |
|---|---|
| `type=daily, interval=n` | `FREQ=DAILY;INTERVAL=n` |
| `type=weekly, daysOfWeek, interval` | `FREQ=WEEKLY;BYDAY=…;INTERVAL=n` |
| `type=absoluteMonthly, dayOfMonth=15` | `FREQ=MONTHLY;BYMONTHDAY=15` |
| `type=relativeMonthly, index=second, daysOfWeek=[friday]` | `FREQ=MONTHLY;BYDAY=2FR` |
| `type=relativeMonthly, index=last, daysOfWeek=[monday]` | `FREQ=MONTHLY;BYDAY=-1MO` |
| `type=absoluteYearly, month=12, dayOfMonth=25` | `FREQ=YEARLY;BYMONTH=12;BYMONTHDAY=25` |
| `type=relativeYearly, month=11, index=fourth, daysOfWeek=[thursday]` | `FREQ=YEARLY;BYMONTH=11;BYDAY=4TH` |
| `range.type=numbered, numberOfOccurrences=k` | `COUNT=k` |
| `range.type=endDate, endDate=d` | `UNTIL=d` |
| `range.type=noEnd` | (sem COUNT/UNTIL) |
| `firstDayOfWeek` | `WKST` |

> `index=last` mapeia para ordinal **-1**. `relativeMonthly/relativeYearly` com `index` ∈
> {first..fourth,last} + `daysOfWeek` cobre exatamente os casos "N-ésimo weekday do mês".
> Observação: Outlook **não** representa "2ª **e** 4ª sexta" numa só regra (usa duas séries) — o que
> conecta com o gap encontrado no nosso protótipo (ver `recurrence-validation.md`).

## Implicações para a nossa lib
- Nosso **modelo canônico interno** deve ser **RFC 5545 (RRULE)**, porque é o mais expressivo; o Outlook
  é um **subconjunto estruturado** que sabemos converter (tabela acima).
- Precisamos de um utilitário **Windows↔IANA timezone** para interop real com Outlook (fase de integração).
- `type: seriesMaster/occurrence/exception` reforça a necessidade de **overrides por ocorrência** no modelo.
