# Validação de recorrência

## Registro histórico dos protótipos

O primeiro protótipo baseado em Temporal passou 28 cenários básicos e 15 de 16 casos extremos. A falha de `BYDAY=2FR,4FR` ocorreu porque um único BYSETPOS global substituía os ordinais individuais. O modelo passou a representar ordinal por entrada de BYDAY; o segundo protótipo passou os 23 cenários então usados.

Essas contagens registram decisões históricas, não cobertura RFC completa ou desempenho atual. Os três harnesses, os dois motores experimentais antigos e seu manifest separado foram removidos na limpeza de 08/10/2026: não eram usados pelo pacote nem pela suíte atual, e continham contratos substituídos. Arquivos ignorados pelo Git foram preservados.

## Evidências atuais

- [Decisão de adoção](../../experiments/civil-recurrence/ADOPTION.md): composição adotada e limites de timezone/DST.
- [Experimento civil](../../experiments/civil-recurrence/REPORT.md): primeiro experimento, identificado como histórico.
- [Resultados de datas](../../experiments/civil-recurrence/comparison.json) e [eventos](../../experiments/civil-recurrence/event-comparison.json).
- [Regressões de recorrência](../../tests/core/recurrence.spec.ts), [exceções](../../tests/core/recurrenceSet.spec.ts) e [divisão de série](../../tests/core/splitSeries.spec.ts).

Para reproduzir a comparação mantida, usando Yarn:

```sh
yarn build
node scripts/compare-recurrence.mjs
node scripts/compare-recurrence-events.mjs
node experiments/civil-recurrence/validate.mjs 10
```

Os comparativos incluem oráculos de teste. O protótipo civil sem Temporal não foi adotado como substituto completo da composição com fuso horário; resultados favoráveis em datas não demonstram correção em horários ambíguos/inexistentes.
