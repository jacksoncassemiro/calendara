# Adoção de recorrência — 07/10/2026

**Decisão atual:** `expandEvent` usa rrule-temporal 2.2.8 para gerar inícios de ocorrências, integrado aos contratos do calendário. A versão é dependência de produção fixa; regras, exceções, overrides, cancelamentos e identidade foram validados nas regressões e no navegador. DTSTART num gap é rejeitado explicitamente, pois a dependência desloca o início explícito e o horário de toda a série.

O iterador próprio de datas gregorianas em `src/core/recurrence/civilIterator.ts` permanece como utilitário independente: `expandRule` converte suas datas para PlainDate e `iterateCivilDates` retorna strings ISO sem Temporal. A primeira comparação abaixo mede essa API de datas, não o backend que agora expande eventos do calendário.

A composição completa dos eventos continua em `recurrenceSet.ts`: fusos, duração, horários locais, RDATE/EXDATE e overrides. Essa camada mantém Temporal e seu fallback. O protótipo antigo `engine.mjs` **não substituiu essa camada**: seus probes mostram três divergências concretas em DST (gap/COUNT, UNTIL em fold e EXDATE do segundo instante repetido). Não remover o polyfill da biblioteca inteira com base nas medições abaixo.

## Comparação reproduzível

```sh
yarn build
node scripts/compare-recurrence.mjs
node experiments/civil-recurrence/validate.mjs 10
```

`comparison.json` registra 1440 comparações diferenciais entre o iterador adotado e a referência Temporal: frequências, início em diferentes fases, intervalos, filtros, COUNT e janelas. A suíte Vitest também compara os cenários existentes com rrule.js, integra exceções/overrides e verifica DST. BYYEARDAY (YEARLY, positivo/negativo) foi acrescentado e validado contra rrule.js.

Benchmark de expansão de regras, **sem composição de eventos**, Node v24.18.1/Windows. Mesmas regras, DTSTART, janelas e saídas ISO; modelos e instâncias preparados antes de medir. Cache de resultados das bibliotecas desligado. Duas rodadas de aquecimento e 25 amostras, com média/mediana/p95. Os tempos abaixo são medianas em milissegundos da execução registrada em `comparison.json`; valores pequenos variam por JIT/GC e ordem de execução.

| Carga | Referência Temporal | Iterador civil + PlainDate | rrule.js 2.8.1 | ical.js 2.2.1 | rrule-temporal 2.2.8 |
|---|---:|---:|---:|---:|---:|
| DAILY desde 2010, janela outubro/2026 | 1,961 | 0,434 | 38,638 | 77,420 | 0,317 |
| WEEKLY intervalo/WKST, 24 resultados | 1,271 | 0,391 | 0,171 | 0,489 | 0,113 |
| MONTHLY segunda/quarta sexta, 24 resultados | 8,850 | 0,425 | 0,166 | 3,004 | 0,137 |
| YEARLY 29/fevereiro, seis resultados | 129,598 | 0,076 | 0,404 | saída divergente | 0,073 |

O motor adotado melhora as quatro cargas frente à referência anterior, mas **não supera todas as bibliotecas**. No anual, construir dias explícitos substitui centenas de objetos por ano; no DAILY distante sem COUNT, saltar períodos substitui a varredura histórica. Isso explica grandes ganhos locais, sem provar superioridade universal. A referência Temporal já recebeu seek sem COUNT nesta revisão, portanto estes resultados não são os mesmos benchmarks antigos de 15–20×.

No caso YEARLY implícito bissexto, o iterador público do ICAL retornou 1/março nos anos seguintes. `comparison.json` preserva ambas as saídas; sua velocidade não foi ranqueada nesse caso. Isso é uma divergência do cenário/API testados, não uma conclusão sobre todos os modos da biblioteca.

`metrics.json` do harness original compara o protótipo de eventos com `expandEvent` atual (rrule-temporal integrado); seus cenários somente de datas usam `expandRule`, que permanece civil. O campo histórico `temporalMs` não representa um backend exclusivamente Temporal e não deve ser lido como medição isolada de rrule-temporal. Use `comparison.json` para a API de datas e `event-comparison.json` para a composição integrada. Não há medição de memória, Safari, Temporal nativo ou throughput da UI.

## Comparação adicional com eventos e DST

`node scripts/compare-recurrence-events.mjs` compara inícios (instantes e horário local), fins de uma hora, RDATE/EXDATE e DST. Cinco saídas equivalentes foram verificadas por assert; cache desligado, 3 aquecimentos e 25 amostras. Artefato: `event-comparison.json`.

| Cenário | Produção atual, mediana ms | rrule-temporal incluindo parsing, mediana ms |
|---|---:|---:|
| Gap ignorado sem consumir COUNT | 3,069 | 0,674 |
| Fold com exclusão do segundo instante | 2,282 | 0,265 |
| Fold com UNTIL UTC | 1,919 | 0,207 |
| RDATE/EXDATE atravessando DST | 3,536 | 0,425 |
| 366 eventos timed | 315,669 | 23,544 |

Essa tabela preserva a rodada **anterior à adoção**. A produção integrada agora passou as regressões de overrides, cancelamentos, identidade e 50 cenários com all-day/timed UTC, além dos fluxos de constraints/recursos no browser. `event-comparison.json` foi atualizado e mede a produção integrada: no caso 366 ocorrências, mediana 47,648 ms e p95 58,291 ms. A rodada anterior registrou 315,669 ms; são execuções distintas no mesmo ambiente, sem garantir um fator universal de ganho. O adapter isolado na rodada nova registrou 10,505 ms incluindo parsing; ele produz menos objetos/metadados que a produção real.

O custo de bundle aumentou: main chunk da demo de 86,67 para 135,94 KB gzip; chunk lazy de @js-temporal/polyfill permaneceu em 49,57 KB gzip. A decisão favorece CPU e delegação da expansão de regras, com aproximadamente 49 KB gzip adicionais na demo, sem alegar redução de dependências ou tamanho. Dados de bundle incluem React/demo, não são tamanho isolado da biblioteca.

O pacote instalado contém um fallback Temporal pré-empacotado no chunk interno; aceitar uma implementação em `temporal` configura a construção dos valores públicos, sem provar que o fallback interno tenha sido removido do bundle. Não resolve sozinho a meta de eliminar polyfills nem garante bundle menor. Os tempos usam Node/Windows e diferentes implementações internas de Temporal; não são medições de latência no celular.

## Técnicas usadas e próximas

- Aplicadas: iterador lazy, validação/budget, seek por período sem COUNT preservando fase, geração direta de BYMONTHDAY, deduplicação antes de BYSETPOS e rank aritmético no DAILY sem filtros com COUNT.
- A contagem timed preserva a política RFC de ignorar gaps sem consumir COUNT; EXDATE continua consumindo. Ela não usa o atalho de COUNT até existir uma prova equivalente com timezone.
- A explorar: máscaras de dias do mês; rank por ciclo gregoriano de 400 anos para regras filtradas com COUNT; cache limitado de conversões/transições de zona; gerador diferencial/fuzzing com casos inválidos; medições de memória e percentis em outros runtimes; workers quando a medição de UI justificar.
- Workers podem melhorar a responsividade, mas não reduzem necessariamente o tempo total. Cache exige limites/invalidação e não substitui otimização do primeiro cálculo.

Não expostos no contrato público: frequências subdiárias, BYHOUR/BYMINUTE/BYSECOND/BYWEEKNO, calendários alternativos, RFC 7529 e interoperabilidade ICS completa. O suporte declarado da dependência não equivale ao suporte integrado da biblioteca. `splitEventSeries` implementa “esta e seguintes” para cortes ativos da RRULE, particionando COUNT/RDATE/EXDATE/overrides; rejeita cortes RDATE-only, troca de timezone/tipo de horário e novo início incompatível com filtros. Datas com anos expandidos na API independente de datas continuam no backend anterior; BYYEARDAY nesses ranges é rejeitado explicitamente. RDATE que exige o segundo instante de fold é rejeitado pelo contrato atual de wall-clock sem offset, em vez de representar silenciosamente o instante errado.

## Fontes primárias consultadas

- [rrule.js](https://github.com/jkbrzt/rrule): API baseada em Date, RRule/RRuleSet e diferenças documentadas em relação ao RFC.
- [ical.js](https://github.com/kewisch/ical.js): parser e iteradores iCalendar; aplicação deve configurar dados de timezone ao usar zonas.
- [rrule-temporal](https://github.com/ggaabe/rrule-temporal): API com ZonedDateTime e documentação de cache/engine de inteiros. Declarações de conformidade do autor não foram tratadas como validação independente.
- [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545#section-3.3.10): semântica dos filtros, COUNT, datas inválidas e horários inexistentes.

O relatório `REPORT.md` preserva o experimento inicial; os arquivos aqui e `comparison.json` representam a decisão atual.
