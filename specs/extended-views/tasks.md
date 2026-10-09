# Tasks and evidence / Tarefas e evidências

- [x] Resource/date columns share the single-day pipeline. / Colunas de recursos/datas compartilham a pipeline de dia único.
- [x] Period resource timelines support grouping and an explicit resource slice. / Timelines de período permitem agrupamento e recorte explícito de recursos.
- [x] Multi-month/year/quarter panels and annual planner have explicit factories. / Painéis mensais/anuais/trimestrais e planejamento anual têm fábricas explícitas.
- [x] Isolated printable agenda uses the complete visible event range. / Agenda imprimível isolada usa o período completo de eventos visíveis.
- [x] New public configurations have short EN/PT JSDoc and generated-reference entries. / Configurações públicas novas têm JSDoc EN/PT curto e entradas na referência gerada.
- [x] Superseded documentation and migration tooling audited and cleaned. / Documentação e ferramentas de migração substituídas foram auditadas e limpas.
- [x] Confirm `yarn verify` and package consumption after all integration changes. / Confirmar `yarn verify` e consumo do pacote após todas as integrações.
- [x] Confirm focused/browser suites for new views, grouping, scroll alignment and printing. / Confirmar suítes focadas/navegador para novas views, agrupamento, alinhamento e impressão.
- [x] Inspect narrow/light/dark screenshots and actual demo/source consistency. / Inspecionar imagens estreitas/claras/escuras e coerência de demo/fonte.
- [x] Record final commands/results in this file before marking validation complete. / Registrar comandos/resultados finais neste arquivo antes de concluir a validação.

No physical device or native PDF-save validation is implied by desktop browser tests.

Testes no navegador desktop não comprovam validação em aparelho físico ou gravação nativa de PDF.

## Evidence / Evidências

`yarn verify`: 366 tests in 37 suites; 34 generated API contracts / 261 fields; types, package build/consumption and site build passed. Contract audit found zero missing JSDoc, monolingual source comments or multi-positional contracts.

`yarn verify`: 366 testes em 37 suítes; 34 contratos / 261 campos da API; tipos, build/consumo do pacote e site aprovados. Auditoria sem JSDoc ausente, comentários monolíngues no código ou contratos multiposicionais.

Focused browser checks cover seven extended views, 24 examples, 360px container and the isolated print snapshot. Screenshots under ignored `output/layout-review/extended-*` were inspected. They exposed missing timeline hours, corrected with a shared date/time header and wider daily tracks.

Testes focados no navegador abrangem sete views adicionais, 24 exemplos, contêiner de 360px e documento isolado de impressão. Imagens em `output/layout-review/extended-*` foram inspecionadas; revelaram horários ausentes na timeline, corrigidos com cabeçalho compartilhado e faixas diárias mais largas.


Full regression: yarn test:browser passed in 98.96s; publication checks and git diff --check passed. Browser fixtures select actual nested header corners, and all-day drag uses an event fully inside the viewport.

Regressão completa: yarn test:browser aprovado em 98,96s; publicação e git diff --check aprovados. Fixtures verificam cantos reais dos cabeçalhos e arrasto com evento totalmente visível.

