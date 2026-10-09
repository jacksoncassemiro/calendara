# Recurrence adoption / Adoção de recorrência

Status: civil iterator integrated into event expansion, October 8, 2026.

Production `ruleStarts` uses `iterateCivilDates` and injected Temporal. `rrule-temporal` 2.2.8 is a development-only independent oracle. `recurrenceSet` retains zoned composition, wall-clock duration, RDATE/EXDATE, overrides, cancellation and original identity. Native Temporal takes priority; `temporal-polyfill` 1.0.5 is the lazy fallback.

Invalid explicit DTSTART is rejected. Nonexistent recurring local times are removed before BYSETPOS and COUNT; excluded occurrences still consume COUNT. UTC/offset UNTIL is converted into the series zone and checked inclusively by instant. Finite COUNT scans from the anchor to preserve DST counting; uncounted rules can seek to the query window. Expansion retains explicit safety budgets.

## Evidence

- `tests/core/ruleStartsOracle.spec.ts`: 153 independent differential/explicit RFC cases across UTC, New York, Lord Howe and Apia.
- `scripts/compare-recurrence.mjs`: 1440 differential date checks and matched date API benchmarks; `comparison.json` includes exact inputs/outputs.
- `scripts/compare-recurrence-events.mjs`: five equivalent integrated zoned event outputs; `event-comparison.json` identifies the production backend.
- `yarn verify`: complete tests, types, build and consumed ESM/CJS archive.
- `yarn test:browser`: integrated recurrence, constraints, gestures, rollback and views with native Temporal absent.

The current event benchmark records 366 timed occurrences at 45.430 ms median / 56.733 ms p95 on Node 24.18.1/Windows. The standalone oracle performs less composition work and is not a like-for-like application benchmark. Small samples vary with JIT/GC and execution order; do not infer universal speed superiority. The paired polyfill benchmark in scripts/compare-temporal.mjs separately holds composition constant.

Month + Day consumer JavaScript fell from 146041 to 70925 gzip bytes under the pinned production fixture. See [current results](../bundle-audit/current-results.json), [before-change results](../bundle-audit/pre-civil-results.json) and [methodology](../bundle-audit/README.md). These totals exclude React/CSS, include lazy chunks and do not measure physical-phone latency.

## Historical prototype

`engine.mjs` is an isolated earlier prototype, not a production backend. `REPORT.md` and `metrics.json` preserve its behavior, including known DST divergences; the harness still compares it to current production. Named production inputs in `validate.mjs` follow the current API. Prototype measurements do not justify substituting its event composer or removing Temporal from all calendar operations.

```sh
yarn build
node scripts/compare-recurrence.mjs
node scripts/compare-recurrence-events.mjs
node experiments/civil-recurrence/validate.mjs 10
```

## Português

A expansão de eventos usa o iterador civil e Temporal injetada; o motor anterior permanece somente como referência independente de desenvolvimento. Fusos, duração, exceções e identidade continuam na composição existente.

DTSTART inexistente é rejeitado. Horários inexistentes da série são filtrados antes de BYSETPOS/COUNT; EXDATE continua consumindo COUNT. UNTIL UTC/offset é convertido ao fuso e comparado por instante, inclusive. COUNT finito exige contagem desde a âncora; regras sem COUNT podem saltar para a janela. Os limites de segurança permanecem.

Os 153 casos zonados, 1440 comparações de datas, cinco saídas integradas, suíte completa e navegador sustentam a adoção. O ganho confirmado é 51,4% no gzip total Mês + Dia; não há promessa universal de desempenho. O protótipo antigo e seus registros ficam identificados como históricos, sem substituir a composição de produção.
