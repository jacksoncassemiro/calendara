# Comparação do fallback Temporal

A Calendara escolhe **temporal-polyfill 1.0.5** como fallback lazy e prioriza Temporal nativo. `@js-temporal/polyfill` 0.5.1 permanece apenas como referência de desenvolvimento, sem ser um segundo fallback de produção.

## Tamanho e recursos

As medições abaixo preservam o retrato de escolha do fallback em 9 de outubro de 2026, antes das adições posteriores de recursos e recorrência ampliada. Não são medidas de bundle ou desempenho da release final.

| Propriedade                                                    | @js-temporal/polyfill 0.5.1 | temporal-polyfill 1.0.5                  |
| -------------------------------------------------------------- | --------------------------- | ---------------------------------------- |
| Chunk de fallback medido na Calendara, gzip                    | 45.459 bytes                | 19.022 bytes                             |
| Datas ISO, horários, fusos IANA, DST, durações e nanossegundos | Suportados                  | Suportados                               |
| Sistemas de calendário na entrada padrão                       | Inclui sistemas não ISO     | ISO/Gregoriano; demais exigem `/full`    |
| Entrada do pacote prioriza Temporal nativo                     | Consumidor detecta suporte  | O pacote também prioriza Temporal nativo |
| Estratégia interna de inteiros                                 | JSBI                        | BigInt nativo                            |
| Uso sem alterar globais                                        | Suportado                   | Suportado; evitar `/global`              |
| Entradas adicionais por função                                 | API de classes              | Classes e funções com tree shaking       |

A Calendara modela datas ISO e usa a API de classes. A entrada padrão menor cobre os contratos atuais; sistemas alternativos não representam novas views do calendário. O consumidor pode injetar um namespace Temporal compatível. A entrada completa acrescenta sistemas de calendário quando necessário. Ver [entradas do temporal-polyfill](https://github.com/fullcalendar/temporal-polyfill/blob/main/polyfill/README.md#package-entrypoints).

O segundo registra atualizações de especificação posteriores à base de março de 2025 descrita pelo `@js-temporal/polyfill` 0.5.x. Número de versão sozinho não estabelece qualidade nem abandono: [changelog da referência](https://github.com/js-temporal/temporal-polyfill/blob/main/CHANGELOG.md), [changelog do candidato](https://github.com/fullcalendar/temporal-polyfill/blob/main/polyfill/CHANGELOG.md).

## Desempenho integrado

Node 24.18.1 / Windows, mesmo motor civil, entradas e saídas completas das ocorrências; cinco aquecimentos e 25 amostras, alternando a ordem dos motores. Valores são medianas em milissegundos.

| Carga                        | @js-temporal/polyfill | temporal-polyfill |
| ---------------------------- | --------------------: | ----------------: |
| 366 ocorrências com horário  |                35,651 |            30,190 |
| Gap DST, COUNT e exclusão    |                 2,944 |             2,432 |
| Fold DST, UNTIL UTC          |                 0,429 |             0,403 |
| Ordinal mensal e override    |                 2,628 |             2,301 |
| Mês visível distante         |                 3,421 |             2,736 |
| Recorrência all-day bissexta |                 0,445 |             0,506 |

As saídas foram iguais nas seis cargas. O candidato vence cinco medianas; alguns p95 e a pequena carga all-day favorecem a referência. Não é classificação universal nem medição de frames no celular. Tamanho, contratos ISO atuais e verificações completas favorecem o candidato no conjunto.

Reproduzir: `yarn build && node scripts/compare-temporal.mjs`. Os [dados brutos e p95](../../experiments/temporal-comparison/results.json) preservam o método. Na medição registrada, os 522 testes e a suíte completa de navegador passaram com o fallback escolhido; essa contagem é histórica.

`rrule-temporal` pertence a outra categoria: motor de recorrência que embute uma implementação Temporal. Seu benchmark isolado faz menos composição que a Calendara; não prova que o motor é mais lento. A substituição eliminou código duplicado de produção preservando a recorrência suportada.
