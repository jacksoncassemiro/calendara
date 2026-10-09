# Documentation cleanup / Limpeza da documentação

## Scope / Escopo

Remove superseded catalogs and one-time migration instructions. Preserve useful technical decisions as neutral scenarios. No Git history rewrite or backup deletion is performed.

Remover catálogos substituídos e instruções de migração pontual. Preservar decisões técnicas úteis como cenários neutros. Não reescrever histórico Git nem excluir backups.

## Inventory / Inventário

| File / Arquivo | Action / Ação | Evidence / Evidência |
|---|---|---|
| `docs/history-reset.md`, `docs/history-reset.pt-BR.md` | Remove / Remover | One-time history migration guidance; not the package release contract. / Orientação de migração pontual, fora do contrato de release do pacote. |
| `scripts/export-clean-repository.mjs`, `export:clean` | Remove / Remover | Only exports `output/fresh-repository`; referenced solely by retired reset guides and the package script. / Apenas exporta `output/fresh-repository`, usado pelos guias retirados e script do pacote. |
| `docs/history/05-API.md` | Remove / Remover | Second handwritten prop catalog duplicated EN/PT API guides and retained obsolete examples. / Segundo catálogo manual de props, duplicado pelos guias EN/PT e com exemplos antigos. |
| `docs/history/status-before-calendara.md` | Rewrite / Reformular | Long session diary included direct answers and obsolete next steps. Keep renderer, recurrence and resource decisions. / Diário com respostas diretas e próximos passos antigos; preservar decisões de renderer, recorrência e recursos. |
| `docs/history/04-ESTILIZACAO.md` | Reduce / Reduzir | Token defaults and breakpoint catalog duplicated CSS and contradicted container responsiveness. Retain geometry/theme separation. / Catálogo de tokens e breakpoints duplicava CSS e contradizia responsividade por contêiner; preservar separação de geometria e tema. |
| `docs/reference/referencias-open-source.md` | Rewrite / Reformular | Initial Preact adoption recommendation conflicted with current React architecture; keep comparison criteria and primary-source links. / Recomendação inicial de Preact conflitava com arquitetura React atual; preservar critérios e fontes primárias. |
| `docs/history/01-ANALISE.md`, `02-PLANO.md`, `03-ARQUITETURA.md` | Keep / Manter | Concise scenarios, execution method and responsibility boundaries; updated snapshot link wording. / Cenários, método e responsabilidades concisos; corrigida indicação do snapshot histórico. |
| `docs/history/06-REVISAO-COMPETITIVA.md` through `09-AUDITORIA-API-E-VIEWS.md` | Keep / Manter | Traceable audit scopes, decisions and validation scenarios distinct from getting started. / Escopos, decisões e cenários de validação rastreáveis, distintos da introdução pública. |
| `docs/history/status-0.1.0.md` | Keep / Manter | Explicit historical release snapshot; not described as current status. / Snapshot explícito da versão histórica; não descrito como estado atual. |
| Other `docs/reference` files / Demais referências | Keep / Manter | Provider mapping, recurrence semantics and resource scenarios remain referenced; no connector implementation is claimed. / Mapeamentos, semântica recorrente e cenários de recursos seguem referenciados, sem alegar conectores implementados. |

## Verification / Verificação

- Repository-wide text search identified all reset/export references before deletion; maintainer index and publication tasks were updated.
- Busca em todo o repositório identificou referências de reset/export antes da exclusão; índice do mantenedor e tarefas de publicação foram atualizados.
- Rewritten records link to current guides or retained experiments instead of maintaining a second current API catalog.
- Registros reformulados apontam aos guias atuais ou experimentos preservados, sem manter um segundo catálogo da API atual.
