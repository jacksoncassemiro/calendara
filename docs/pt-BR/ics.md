# Importação e exportação iCalendar

O adaptador do core lê e escreve um subconjunto limitado da [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545). Não há dependência adicional de runtime. A importação é atômica: semânticas de agendamento não suportadas lançam `RangeError`, em vez de retornar uma agenda parcialmente convertida. Persistência, seleção de arquivo, download e resolução de conflitos continuam sob responsabilidade do consumidor.

```ts
import {
  ensureTemporal,
  importICalendar,
  exportICalendar,
} from '@jacksoncassemiro/calendara/core';

const temporal = await ensureTemporal();
const imported = importICalendar({
  text: await file.text(),
  calendarId: 'personal',
  temporal,
});
// Revise os diagnósticos antes de salvar imported.events.
const exported = exportICalendar({
  events: imported.events,
  temporal,
  timestamp: '2026-10-09T12:00:00Z',
});
// Revise exported.diagnostics antes de baixar exported.text.
```

`UID` se torna o ID do evento. A importação atribui o `calendarId` fornecido; a exportação não codifica IDs de agenda do consumidor. A importação retorna eventos avulsos e mestres recorrentes, com exceções agrupadas por UID independentemente da ordem dos componentes. Não há mesclagem com eventos existentes do consumidor.

São suportados `SUMMARY`, `DESCRIPTION`, intervalos de dia inteiro com datas, horários locais flutuantes com segundos inteiros, horários UTC e horários locais com `TZID` IANA. O fim de dia inteiro continua exclusivo; a ausência de `DTEND` em dia inteiro significa um dia. Eventos com horário exigem `DTEND` e duração positiva. Ambos os extremos devem usar o mesmo tipo e fuso. Não há conversão para o fuso local do navegador.

`RRULE` usa os campos suportados de `parseRRule`. `RDATE` e `EXDATE` devem coincidir com o tipo e fuso do mestre. Um `VEVENT` separado com `RECURRENCE-ID` se torna uma exceção indexada pelo início original preservado. Ocorrências movidas mantêm sua identidade e duração; `STATUS:CANCELLED` em uma ocorrência cria uma exceção de cancelamento. A exportação suporta alterações de título, descrição e horário, além de cancelamento. Outros campos de alteração lançam erro. A chave de uma exceção com horário deve incluir o horário local original, em vez de uma chave alternativa somente com a data.

`UNTIL` deve coincidir com o tipo DATE/DATE-TIME do início. Séries com horário e fuso exigem `UNTIL` UTC; séries com horário flutuante exigem `UNTIL` local. Valores flutuantes não têm fuso no modelo de evento e seguem o fuso da agenda consumidora durante a renderização.

A importação aceita linhas dobradas ou contínuas e escapes de TEXT. A exportação usa CRLF e dobra linhas em 75 octetos UTF-8, sem dividir um caractere Unicode. Exige timestamp UTC explícito com segundos inteiros para `DTSTAMP`, tornando a saída determinística. Extremos UTC são escritos com `Z`.

**Interoperabilidade de fusos:** nomes IANA são validados contra a base de fusos do Temporal. A exportação preserva `TZID` IANA, mas não inclui `VTIMEZONE`; retorna um diagnóstico exigindo que o cliente receptor forneça sua base de fusos. A saída se destina a clientes que entendem nomes IANA, em vez de definições RFC autossuficientes de fuso. A importação rejeita todo componente `VTIMEZONE`, inclusive uma definição incorporada de nome IANA, para evitar substituir silenciosamente regras fornecidas por regras locais diferentes. Definições personalizadas de fuso exigem outro adaptador.

A importação rejeita alarmes, participantes, organizadores, durações, períodos de RDATE, métodos de agendamento, calendários não gregorianos, propriedades personalizadas, `RANGE=THISANDFUTURE`, mestres cancelados e status/parâmetros não suportados. Também rejeita mestres/identidades duplicados, datas inválidas, tipos de recorrência incompatíveis e exceções sem mestre recorrente. A entrada é limitada a 5 MiB de unidades UTF-16. Este adaptador não é um cliente CalDAV nem um processador de convites de reunião.

Os diagnósticos identificam campos de transporte omitidos na importação (`DTSTAMP`, `CREATED`, `LAST-MODIFIED`, `SEQUENCE`) e campos do consumidor omitidos na exportação (`calendarId`, cor, editabilidade, recursos e metadados livres). Esses campos não são preservados na ida e volta. A exportação rejeita extremos com frações de segundo ou offset; use o contrato da biblioteca de horário local mais `timeZone`. Revise todos os diagnósticos antes de persistir dados importados ou entregar dados exportados.
