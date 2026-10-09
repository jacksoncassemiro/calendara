# Recorrência

Calendara expande valores estruturados `RRuleModel` ou strings RRULE com as sete frequências RFC 5545: `SECONDLY`, `MINUTELY`, `HOURLY`, `DAILY`, `WEEKLY`, `MONTHLY` e `YEARLY`. Frequências intradiárias exigem eventos com horário e são expandidas por `expandEvent`.

Os campos suportados são `INTERVAL`, `COUNT`, `UNTIL`, `BYMONTH`, `BYWEEKNO`, `BYYEARDAY`, `BYMONTHDAY`, `BYDAY`, `BYHOUR`, `BYMINUTE`, `BYSECOND`, `BYSETPOS` e `WKST`. Campos não suportados, duplicados, inteiros inválidos e combinações inválidas lançam `RangeError`; regras estruturadas recebem a mesma validação. `COUNT` e `UNTIL` são mutuamente exclusivos.

```ts
const recurrence = {
  rule: 'FREQ=WEEKLY;BYDAY=MO,FR;BYHOUR=9,17;BYMINUTE=0;COUNT=12',
};
```

`BYWEEKNO` aceita semanas positivas e negativas em regras anuais. `WKST` define os limites das semanas; a semana 1 contém pelo menos quatro dias do novo ano. `BYDAY` ordinal é permitido somente com regras mensais ou anuais, e nunca junto a `BYWEEKNO`. `BYMONTHDAY` é inválido em regras semanais; `BYYEARDAY` é inválido em regras diárias, semanais ou mensais. `BYSETPOS` exige outro campo `BY` e seleciona candidatos únicos e ordenados dentro de um período da frequência.

Regras com horário preservam a hora civil local no fuso da série. Horários locais inexistentes são descartados antes de `BYSETPOS` e `COUNT`. Um horário local repetido usa a primeira ocorrência da repetição. Vários inícios na mesma data mantêm a identidade completa de data e hora original, duração, exclusões e alterações por ocorrência. Em eventos de dia inteiro, filtros de horário são ignorados conforme exigido para valores DATE; frequências intradiárias são rejeitadas. As APIs inferiores de expansão por data não aceitam regras com horário.

O conjunto recorrente combina RRULE e `rDates`, remove inícios originais duplicados e aplica `exDates` e alterações por ocorrência. As exclusões removem ocorrências depois do consumo de `COUNT` pela regra. O consumidor controla armazenamento e edição das ocorrências.

Regras infinitas exigem uma janela com data final. A expansão preserva a fase do intervalo ao buscar janelas distantes sem `COUNT`; regras com `COUNT` inspecionam os inícios válidos anteriores. Limites de trabalho lançam erro em vez de retornar uma série incompleta: a expansão com horário visita até 50.000 períodos e admite até 100.000 candidatos por período. Reduza a janela ou os filtros de horário se um limite for excedido.

Esta é uma cobertura ampla de recorrência RFC, não uma implementação completa de iCalendar. Segundos intercalares (`BYSECOND=60`) são rejeitados porque as implementações Temporal injetadas não os representam. Regras com horário e `BYWEEKNO`/`BYYEARDAY` usam anos gregorianos de quatro dígitos. As regras existentes de dia inteiro aceitam `UNTIL` com data e hora, e regras com horário aceitam `UNTIL` somente com data, como extensões de conveniência; a importação estrita de iCalendar deve validar os tipos de DTSTART/UNTIL. O conjunto recorrente do core representa inícios extras, não durações RDATE PERIOD, múltiplas propriedades RRULE ou definições VTIMEZONE.

Referência semântica: [RFC 5545 §3.3.10](https://www.rfc-editor.org/rfc/rfc5545#section-3.3.10).
