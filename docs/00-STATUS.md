# Calendara — estado atual

Atualizado em 2026-10-08. Biblioteca React nativa, pacote único `@jacksoncassemiro/calendara`, versão candidata 0.1.0, licença MIT. Projeto pessoal e experimental desenvolvido com assistência do Codex; ainda não publicado.

## Uso e organização

- Documentação pública: [português](pt-BR/README.md) e [inglês](en/README.md). O site reúne referência gerada da API e playground; o fluxo GitHub Pages está preparado.
- `views` é obrigatória e define a lista completa. `BUILTIN_VIEWS` é um atalho explícito. `initialView`/`initialDate` configuram montagem; `view`/`date` solicitam navegação quando mudam.
- Componentes reais ficam na raiz de `src/react/views`; apresentação, layout, formatação, modelos, registro e hooks compartilhados ficam em subpastas próprias.
- Instruções gerais em `AGENTS.md`; skill específica em `.agents/skills/calendara-review/SKILL.md`. Prettier e EditorConfig mantêm formatação consistente.
- Referências descrevem cenários genéricos. Histórico e experimentos referenciados são evidências de engenharia, separados dos guias públicos.

## Implementação auditada

Persistência pertence ao consumidor. Gestos preservam duração, identidade da ocorrência e fim exclusivo, com prévia, cancelamento e rollback assíncrono. Arraste externo é opt-in. Auto-scroll usa a página ou containers existentes e pode ser desativado.

Capacidade global/por recurso/ilimitada, buffers e restrições de horário são independentes da sobreposição visual. Editor próprio e editor padrão usam a mesma validação. Fontes remotas recebem AbortSignal; respostas obsoletas não substituem os dados atuais.

O backend de recorrência adotado é `rrule-temporal` 2.2.8; o iterador civil continua como utilitário e experimento. O polyfill ainda é necessário em navegadores sem Temporal. [Resultados e limites](../experiments/civil-recurrence/ADOPTION.md).

O fallback interno de views foi removido após confirmar retenção indevida. Apenas Dia passou de 145.645 para 142.381 bytes gzip no experimento; não há equivalência de recursos com os concorrentes. [Comparação reproduzível](pt-BR/bundle-comparison.md).

## Validação e publicação

Tipos, build, pacote ESM/CJS e consumidor aprovados; 344 testes em 33 arquivos aprovados. Os 26 roteiros de calendário passaram no Edge. A documentação passou separadamente no build estático com base `/calendara/`, inclusive layouts de 320/375 px, idiomas, busca e links. Artefatos em `output/`, ignorado pelo Git.

Auditoria de dependências em 08/10: nenhum advisory conhecido. Workflows passaram no actionlint. Empacotamento de release passou em fixture Git isolada, incluindo rejeição de versão, checkout sujo e tag incompatível. [Controles de publicação](publishing-security.md).

O remoto foi renomeado para `calendara`. Continua privado. Main/develop exigem PR/CI; tags de versão são protegidas e ambientes aceitam main. Pages via Actions foi habilitado. Revisores obrigatórios no ambiente foram recusados pelo plano do GitHub; release permanece draft com publicação manual. Nenhuma release ou reescrita do histórico foi realizada.

## Limites e backlog

Safari/iOS/Android físicos, leitores de tela e runtime React 18 não foram validados nesta rodada. Não há paridade completa: RFC 5545 inteiro, ICS, virtualização de recursos, timeline de recursos de vários dias, undo/redo, RTL e gestos por teclado permanecem backlog. Validação de negócio de toda a série futura e concorrência no backend pertencem ao consumidor.

Critérios: [auditoria de API](09-AUDITORIA-API-E-VIEWS.md), [tarefas de correção](../specs/calendar-remediation/tasks.md) e [publicação](../specs/publication/tasks.md). O [histórico anterior](history/status-before-calendara.md) registra decisões e medições anteriores, sem representar o contrato atual.
