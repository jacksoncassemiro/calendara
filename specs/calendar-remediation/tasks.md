# Execução e evidências

Estados: `[ ]` pendente; `[~]` implementação em andamento; `[x]` implementado e validado. Mudança de código sem teste concluído não recebe `[x]`.

- [x] T01 / API-01 — seleção exata e inicial das views. Evidência anterior: `browser-view-selection-review.js`; suíte anterior 322 testes e 23 scripts browser. Será revalidado na integração.
- [x] T02 / API-02, DATA-01 — callbacks e cancelamento de fontes; testes de lifecycle e integração React.
- [x] T03 / API-03 — remoção de opções declarativas restaura defaults; testes de lifecycle.
- [x] T04 / RES-01 — composição de constraints e validação de todos recursos; testes core/React de regras locais, buffers e capacidade.
- [x] T05 / CODE-01 — nomes claros no editor e nos oito arquivos de testes revisados; regressões preservadas. Não representa revisão de cada identificador do repositório.
- [x] T06 / DRAG-01 — ponte React, entrada externa e testes core/browser nas cinco views interativas.
- [x] T07 / DRAG-02 — saída opt-in, cancelamento e testes core/browser; consumidor decide persistência.
- [x] T08 / QA-01 — `yarn verify`: 343 testes/33 arquivos, tipos/build/tarball/consumidor/demo. Browser completo: 25 roteiros Edge, console sem erros; screenshots inspecionados.
- [x] T09 — guia de API/status atualizados; evidências abaixo.
- [x] T10 / EDIT-01 — editor independente, validação compartilhada `evaluateEvent`, identidade correta e guia de formulário próprio. Ver `editor-extensibility.md`.
- [x] T11 / DOC-01 — JSDoc curto EN/PT nos contratos públicos revisados: props, handle, slots, opções e modelos de evento/data/recorrência/regras/recursos.
- [x] T12 / DESIGN-01 — tema padrão refinado; verificado sem CSS do playground, em desktop/320/375px, com cores/tokens personalizados.
- [x] T13 — data inicial/Hoje no fuso configurado, respeitando relógio injetado e navegação explícita; regressões Kiritimati/Honolulu.
- [x] T14 — view inativa/ordem não refaz busca; mudança do range ativo refaz; nomes vazios recusados. `viewSourceInvalidation.spec.ts` e browser de seleção.
- [x] T15 — mês compacto segue a data de referência e navegação no mesmo mês; `browser-default-theme-review.js`.

## Evidências desta rodada

Logs: `output/sdd-verify.log`, `output/sdd-browser.log` e `output/sdd-final-browser.log`. O último repete seleção de views/tema após a recusa de nomes vazios. Screenshots em `output/layout-review/`, incluindo `default-theme-desktop.png`, `default-theme-month-375.png` e `external-drag-react-preview.png`.

O build da demo mantém aviso de chunk acima de 500 KB: 513,78 KB minificado / 150,63 KB gzip. Tipos React 18 foram validados na rodada anterior; runtime atual é React 19. Safari/toque físico/leitores de tela não foram executados.

## Próximas especificações

Criar fatias independentes para os recursos candidatos enumerados em `spec.md`, com API e casos de uso antes de implementação. Não converter recursos opcionais em bloqueio silencioso da auditoria nem marcar trabalho futuro como concluído.
