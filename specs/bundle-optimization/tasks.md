# Tasks and evidence / Tarefas e evidências

- [x] Preserve before-change fixture: experiments/bundle-audit/pre-civil-results.json.
- [x] Remove production rrule-temporal dependency; retain development oracle, with no compatibility backend.
- [x] Validate 153 independent zoned recurrence cases, including DST gaps, UTC UNTIL, Apia and BYSETPOS ordering.
- [x] Verify native priority, shared fallback loading/cache and failed-import retry (3 loader tests).
- [x] Full yarn verify: 522 tests / 39 suites, 34 API contracts / 261 fields, build, ESM/CJS/CSS and React TypeScript archive consumer.
- [x] Browser integration: final isolated suite passed in 108.01s with temporal-polyfill, including recurrence exceptions, gestures, resources, rollback, touch simulation, sticky headers and focused demos.
- [x] Compare both polyfills with equal complete outputs: six matched workloads, alternating 25 samples; temporal-polyfill wins five medians and saves 26437 gzip bytes in the fallback chunk. Document default ISO/Gregorian versus `/full` calendar coverage.
- [x] Match bundle fixtures: Month + Day 146041 → 70925 gzip bytes; entry 83195 → 34516. Day 67928 gzip bytes. Native fallback and overflow chunks remain lazy.
- [x] Update EN/PT API/comparison/changelog, verify formatting/publication metadata and close stale publication tasks against remote release/environment evidence.
- [x] Run date comparison (1440 differential checks), integrated event comparison (five equivalent outputs), and repair historical prototype harness calls to named production inputs.

Português: testes diferenciais e integrados, consumidor do pacote e navegador passaram; comparação reduziu Mês + Dia em 51,4%. Formatação e metadados de publicação conferidos. Simulação Chromium não equivale a celular físico/Safari/leitor de tela. Virtualização automática permanece proposta em specs/extended-views/virtualization.md.
