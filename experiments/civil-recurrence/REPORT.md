# Experimento de recorrência gregoriana sem Temporal

> Histórico do primeiro experimento. O iterador de datas foi adotado posteriormente, com timezone/DST preservados na camada de composição. Consulte [ADOPTION.md](ADOPTION.md) e comparison.json para a comparação atual. Os números antigos abaixo não descrevem o motor atual.

Execução atualizada em 07/10/2026 às 16:20:48 (America/Sao_Paulo), depois do rebuild do core com validação de RRULE e guarda para fevereiro impossível. Node v24.18.1, Windows, polyfill instalado `@js-temporal/polyfill@0.4.4`. O motor experimental não importa bibliotecas: usa inteiros de dias, `Date` com métodos UTC e `Intl.DateTimeFormat` somente para projetar valores que já possuem offset/UTC na timezone do evento. O motor atual de produção também é próprio; Temporal fornece a representação e a aritmética das datas, não interpreta RRULE.

## Validação executada

`node experiments/civil-recurrence/validate.mjs 10`

- 50 cenários de `packages/core/tests/scenarios.ts`: mesmos resultados do motor Temporal atual e de rrule.js. Cobrem quatro frequências, intervalo, COUNT, UNTIL, dias inexistentes, ano bissexto, ordinais positivos/negativos/listas, BYSETPOS, EXDATE e WKST.
- 13 integrações comparando ocorrências completas: datas/horários/duração, título, chave original, mestre, exceções UTC e date-only, RDATE com hora própria, override de título/cancelamento, deslocamento para janela diferente, COUNT, UNTIL inclusivo e duração all-day atravessando fevereiro bissexto.
- As integrações usam America/New_York na transição de março de 2024. Elas validam composição de horários locais e conversão de exceções/UNTIL UTC pelo Intl; não demonstram resolução completa de horários locais inexistentes ou ambíguos.
- Implementação experimental isolada: `engine.mjs`. Oráculos e dependências aparecem apenas em `validate.mjs`; resultados brutos em `metrics.json`.

## Medição end-to-end

Mesmos eventos, regras, exceções, janelas e objetos de saída nas duas implementações. Médias de dez iterações depois de dois aquecimentos; parsing e composição estão incluídos.

| Entrada | Ocorrências | Temporal polyfill | Experimental civil | Razão |
|---|---:|---:|---:|---:|
| DAILY com COUNT, exceção UTC, RDATE e override durante DST | 40 | 6,71 ms | 0,35 ms | 19,22× |
| MONTHLY com segunda e quarta sexta | 24 | 9,17 ms | 0,44 ms | 20,79× |
| YEARLY em 29 de fevereiro | 6 | 104,62 ms | 5,61 ms | 18,65× |
| DAILY começando em 2010, janela em outubro de 2026 | 31 | 317,89 ms | 20,51 ms | 15,50× |

Estes números mostram uma oportunidade real de reduzir custos de expansão civil. Não são medidas de render React, DOM, Safari, bundle, Temporal nativo ou throughput de um motor RFC completo. As duas implementações ainda percorrem períodos anteriores à janela para manter COUNT: a versão experimental pode melhorar com salto de períodos quando COUNT não existe.

## Comparação de expansão da regra com rrule.js

Medição separada: modelos, DTSTART e instância rrule são preparados antes da medição; somente expansão e normalização dos resultados para datas ISO entram no tempo. O cache de resultados rrule foi desabilitado (`new RRule(options, true)`). Regras, início, janelas e saídas são idênticos e conferidos nas três implementações. Sem composição de eventos, duração, timezone, RDATE/EXDATE ou overrides nesta tabela.

| Regra | Resultados | Motor atual/Temporal | Experimental civil | rrule.js |
|---|---:|---:|---:|---:|
| DAILY desde 2010; UNTIL 31/10/2026; janela outubro/2026 | 31 | 381,06 ms | 19,30 ms | 55,21 ms |
| WEEKLY, intervalo 2, SU/MO/WE, WKST SU, COUNT 24 | 24 | 1,36 ms | 0,09 ms | 0,12 ms |
| MONTHLY, segunda e quarta sexta, COUNT 24 | 24 | 13,56 ms | 0,62 ms | 2,57 ms |
| YEARLY, 29/fevereiro, COUNT 6 | 6 | 179,82 ms | 8,20 ms | 0,55 ms |

O experimental ganhou do rrule em três entradas, mas **rrule foi aproximadamente 15× mais rápido em YEARLY bissexto**. O protótipo percorre todos os dias dos anos; rrule oferece uma referência concreta de otimização nesse caso. Uma média pequena não justifica declarar uma biblioteca universalmente mais rápida. As variações entre microbenchmark e composição são esperadas com JIT/GC/ordem de execução; novas decisões devem usar amostras maiores e outras cargas.

## Uso das APIs sem Temporal

```js
import { expandCivilRule, expandCivilEvent } from './experiments/civil-recurrence/engine.mjs';

const dates = expandCivilRule(
  { freq: 'MONTHLY', count: 4, byDay: [{ weekday: 'FR', ordinal: 2 }, { weekday: 'FR', ordinal: 4 }] },
  '2026-10-01',
);

const occurrences = expandCivilEvent({
  id: 'meeting', calendarId: 'work', title: 'Reunião',
  time: {
    allDay: false,
    start: { dateTime: '2026-10-01T09:00:00', timeZone: 'America/Sao_Paulo' },
    end: { dateTime: '2026-10-01T10:00:00', timeZone: 'America/Sao_Paulo' },
  },
  recurrence: {
    rule: 'FREQ=WEEKLY;BYDAY=TH;COUNT=4',
    exDates: ['2026-10-08'],
    rDates: ['2026-10-09T11:00:00'],
  },
}, { start: '2026-10-01', end: '2026-10-31' });
```

A API de rrule usa `Date` como portador de campos UTC no exemplo de regra civil. Composição de evento e política de timezone continuam sendo outra responsabilidade:

```js
import rrulePkg from 'rrule';
const { RRule } = rrulePkg;
const rule = new RRule({
  ...RRule.parseString('FREQ=MONTHLY;BYDAY=2FR,4FR;COUNT=4'),
  dtstart: new Date('2026-10-01T00:00:00Z'),
}, true);
const dates = rule.all().map((date) => date.toISOString().slice(0, 10));
```

## Contrato e limites

O protótipo exporta `expandCivilRule(model, dtStart, window)` (datas ISO) e `expandCivilEvent(event, window)` (EventOccurrence[]). Aceita DAILY/WEEKLY/MONTHLY/YEARLY; BYMONTH; BYMONTHDAY positivo/negativo; BYDAY com ordinal por entrada; BYSETPOS deduplicado; WKST; COUNT; UNTIL; rDates/exDates/overrides. Usa duração de relógio local, como a implementação atual. EXDATE date-only exclui o dia inteiro por contrato atual; datetime exclui o início exato.

Não deve substituir produção ainda:

1. Não resolve wall-clock sem offset para instante de forma independente. Isso exige uma política explícita para DST fold/gap, incluindo horários como 02:30 inexistente e 01:30 repetido; Intl pode apresentar instantes na zona, mas não oferece a operação inversa diretamente. Uma lib própria precisa implementar e validar essa camada ou manter uma ferramenta dedicada para ela.
2. A comparação é com o subset atual, não com RFC 5545 inteiro. BYHOUR/BYMINUTE/BYSECOND/BYWEEKNO/BYYEARDAY e frequências subdiárias não são implementados. Modelos estruturados não têm validação completa de todas as combinações BY*. A string experimental rejeita partes desconhecidas.
3. O experimento trabalha com calendário gregoriano e anos ISO de quatro dígitos. Anos expandidos, calendário não gregoriano e limites extremos do Date não foram validados. Precisão submilissegundo é perdida pelo Date.
4. O protótipo tem limite de 2000 períodos vazios; o motor de produção passou a usar orçamento explícito de períodos e uma guarda para filtros de mês/dia impossíveis. Essa diferença não é prova matemática de impossibilidade para todo intervalo/filtro. COUNT grande e janela muito distante podem consumir CPU; uma versão de produção precisa de limites e/ou salto controlado.
5. Faltam fuzzing diferencial amplo, política de erros definitiva, cancelamento, benchmark de memória e validação ampla em navegadores reais. Um cenário integrado passou no Edge sem Temporal global em 07/10/2026; isso não valida Safari/Android. O sucesso nesses 63 cenários não elimina bugs compartilhados com o motor atual.

Decisão sugerida: considerar aritmética civil própria para o iterador RRULE e manter timezone/DST como camada separada. Só migrar após testes diferenciais extensos e cobertura explícita dos casos de tempo ambíguo/inexistente. O benchmark não justifica remover timezone de forma implícita.

## Fontes primárias

- [RFC 5545, regras de recorrência](https://www.rfc-editor.org/rfc/rfc5545#section-3.3.10)
- [Temporal: distinção entre tipos locais e zoned](https://tc39.es/proposal-temporal/docs/)
- [Polyfill Temporal, implementação e notas de migração](https://github.com/js-temporal/temporal-polyfill)

O benchmark usa a versão instalada 0.4.4, não a versão mais recente publicada; comparações com outras versões precisam de nova execução.
