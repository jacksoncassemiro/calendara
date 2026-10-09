# Comparação de bundle e integração

Medição de 08/10/2026. Manter um pacote React. Os resultados apontam uma oportunidade de melhorar o tree shaking interno; não justificam dividir a instalação em vários pacotes.

## Contribuição de JavaScript

Todas as linhas usam Vite 8.3.3 em produção, ES2022 e a mesma exclusão de React/React DOM. CSS fica fora. Os totais incluem todos os chunks JavaScript, comprimidos individualmente. São medidas da contribuição da biblioteca, não do playground, do arquivo npm, da velocidade no navegador ou de recursos avançados equivalentes.

| Cenário                                          | Versão                       | Bytes minificados | Bytes gzip | Chunks JS |
| ------------------------------------------------ | ---------------------------- | ----------------: | ---------: | --------: |
| Calendara: Dia                                   | local 0.1.0                  |           478.823 |    139.609 |         4 |
| Calendara: Mês + Dia                             | local 0.1.0                  |           490.413 |    142.417 |         4 |
| Calendara: padrão + recursos + timeline + editor | local 0.1.0                  |           520.452 |    149.747 |         4 |
| FullCalendar: Mês + Dia, tema Monarch            | React 7.1.1                  |           256.315 |     70.580 |         1 |
| Schedule-X: Mês + Dia, Temporal exigido          | calendar 4.9.1 / React 4.1.0 |           235.920 |     68.704 |         1 |
| Mantine: Mês + Dia, provider                     | 9.7.1                        |           276.794 |     85.076 |         1 |
| React Big Calendar: Mês + Dia, localizer Day.js  | 1.20.0 / Day.js 1.11.23      |           184.318 |     54.871 |         1 |

Mês + Dia da Calendara contém uma entrada de 79.660 bytes gzip, um fallback Temporal de 45.459, um popover lazy de 16.761 e um chunk compartilhado de rótulos de 537. Temporal nativo pode evitar o download do fallback. O popover fechado não precisa carregar seu chunk imediatamente. Comparar o total com uma entrada única do concorrente representa a transferência no pior caso, não uma classificação do custo inicial.

A auditoria inicialmente encontrou `MonthView`, `ListView` e `defaultViews` na configuração de Dia: o controller referenciava `BUILTIN_VIEWS` como fallback quando as views eram omitidas. Dia tinha 145.645 bytes gzip e Mês + Dia tinha 145.652, diferença de apenas 7 bytes. Na rodada anterior às atualizações finais de dependências/localização, após retirar esse fallback do controller e exigir definições explícitas, Dia eliminou os três módulos e caiu para 142.381 bytes. Mês + Dia caiu para 145.208: selecionar somente Dia então economizava 2.827 bytes frente a essa configuração. A [baseline](../../experiments/bundle-audit/baseline.json) preserva as medidas originais.

O popover compartilhado permanece intencionalmente: Dia o usa para acessar eventos excedentes. A implementação de recorrência também permanece sem eventos recorrentes. Adicionar views padrão, recursos, timeline e editor aumenta o total gzip final de Mês + Dia em 7.330 bytes nesta fixture. A maior parte do custo atual é do mecanismo compartilhado, não das views opcionais.

A [receita com lockfile fixado](../../experiments/bundle-audit/README.md) reproduz a comparação. Os [resultados brutos](../../experiments/bundle-audit/results.json) registram tamanhos por chunk e módulos locais mantidos. Calendara usa a entrada pública `src/index.ts` com transformação de produção; este experimento não testa instalação do arquivo de release ou a entrada gerada em `dist`. A compilação Vite valida o bundle; não valida interações ou acessibilidade dos concorrentes.

A execução final acima inclui o fallback `@js-temporal/polyfill` 0.5.1 da Calendara e as correções de localização/interação. O ambiente de desenvolvimento do pacote usa React/React DOM 19.3.0 e jsdom 30.1.2; React está excluído desta medição, e jsdom é dependência somente de testes. A fixture fixada dos concorrentes ainda registra React 19.2.0, também excluído. Não afirmamos igualdade das dependências de desenvolvimento instaladas. Dia agora economiza 2.808 bytes gzip frente a Mês + Dia. Os valores anteriores preservam a evidência histórica da correção do registro de views, não representam os totais atuais.

## Vantagens e desvantagens da integração

| Biblioteca         | Integração inicial                                              | Capacidades separadas                                              | Consequência prática                                                                                                                                   |
| ------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Calendara          | JSX, eventos e definições obrigatórias das views; tema opcional | Um pacote com entrada `/core`; editor pode ficar fora do JSX       | Menos decisões de instalação; persistência explícita e contratos de datas precisam de explicação; custo compartilhado de recorrência/runtime permanece |
| FullCalendar 7     | JSX, plugins de views/tema e estilos                            | Subpaths de plugins no React; Scheduler separado e premium         | Seleção precisa de capacidades; plugins, tema e licença acrescentam escolhas                                                                           |
| Schedule-X         | Hook da aplicação, factories de views, wrapper React e estilos  | Serviços e interações por plugins; peers Preact/signals e Temporal | Extensibilidade ampla; mais versões e runtimes para alinhar                                                                                            |
| Mantine            | Schedule ou views isoladas, provider e estilos Mantine          | Pacotes schedule/dates/core/hooks                                  | Conveniente em app Mantine existente; mais configuração sem Mantine; peers atuais exigem React 19.2                                                    |
| React Big Calendar | JSX, localizer, altura explícita e estilos                      | Addon de drag-and-drop e escolha de localizer                      | API React familiar e escolha da biblioteca de datas; configuração de localização e geometria obrigatória                                               |

Essas diferenças são contratos observáveis, não um estudo com usuários comprovando maior facilidade. FullCalendar documenta plugins e React 17–19 no [guia React](https://fullcalendar.io/docs/react). Schedule-X lista hook, peers e componentes customizados no [guia React](https://schedule-x.dev/docs/frameworks/react). Mantine documenta dependências, estilos e Day.js obrigatório em [getting started](https://mantine.dev/schedule/getting-started/). React Big Calendar documenta localizers, CSS e altura no [README](https://github.com/bigcalendar/react-big-calendar#readme).

Os recursos implementados da Calendara são MIT, incluindo recursos, timeline, recorrência e mover/redimensionar. FullCalendar lista views de recursos, timelines e impressão no [Premium](https://fullcalendar.io/docs/premium). Schedule-X distribui extensões por [plugins](https://schedule-x.dev/docs/calendar/plugins); confira a licença atual de cada um, sem estender automaticamente a licença MIT do core a todas as extensões. Isso não afirma paridade completa ou maturidade de produção.

## Reclamações e conclusões acionáveis

A issue [#7029](https://github.com/fullcalendar/fullcalendar/issues/7029) do FullCalendar relatou aumento de tamanho no Bundlephobia em uma beta v6 de 2022 e está fechada. Ela reforça medir bundles de consumidores, em vez de citar o tamanho do pacote; não descreve o desempenho da v7 atual. Um relato não estabelece frequência de reclamações. Não foi encontrada nas fontes revisadas uma reclamação verificada que exigisse vários pacotes para uma API equivalente à Calendara.

Prioridades recomendadas:

1. Preservar uma instalação e contrato de compatibilidade. O fallback do controller foi retirado; avaliar entradas leves por subpath somente se novas medidas de consumidores justificarem.
2. Medir carregamento opcional da recorrência antes de mudar seu contrato. Preservar o fallback Temporal para navegadores que precisam dele.
3. Documentar lazy loading por rota para apps que usam o calendário ocasionalmente. Isso adia o carregamento; não elimina o custo total.
4. Manter editor, CSS e renderers próprios opcionais. A seleção agora elimina implementações de views não utilizadas, mas não deve ser divulgada como uma grande redução do bundle.

Vários pacotes npm trariam alinhamento de versões, coordenação de releases e mais decisões de instalação. Subpath exports e limites internos compartilhados podem oferecer modularidade mantendo um único pacote. A auditoria levou à definição obrigatória e explícita das views; o experimento não adiciona dependências de produção.

## Custo de Floating UI e alternativas nativas

A fonte atual foi medida novamente em 8 de outubro de 2026 com o mesmo Vite de produção e fixture fixa dos concorrentes. A tabela anterior permanece como **registro histórico da 0.1.0**. A fonte atual contribui:

| Cenário                                               | Bytes minificados | Bytes gzip |
| ----------------------------------------------------- | ----------------: | ---------: |
| Calendara Dia                                         |           491.797 |    143.018 |
| Calendara Mês + Dia                                   |           504.338 |    146.041 |
| Calendara padrão + recursos/timeline diários + editor |           538.568 |    154.093 |
| FullCalendar Mês + Dia                                |           256.315 |     70.580 |
| Schedule-X Mês + Dia                                  |           235.920 |     68.704 |
| Mantine Mês + Dia                                     |           276.794 |     85.076 |
| React Big Calendar Mês + Dia                          |           184.318 |     54.871 |

As fixtures não igualam recursos/recorrência/validação. Calendara continua maior nessa comparação; separar pacotes ou retirar uma dependência não estabelece paridade. As novas views de período/planejamento não são selecionadas nessas fixtures nem integram a terceira linha.

Somente `MonthMorePopover` importa Floating UI na fonte da biblioteca. Usa posicionamento com offset/flip/shift/atualização automática, fechamento externo/Escape, papel acessível e gerenciamento/retorno de foco não modal. Mês + Dia mantém isso em chunk lazy: **46.568 bytes minificados / 16.763 bytes gzip**, cerca de **11,5%** do total gzip. O entry tem 83.195 bytes gzip e nenhum módulo Floating UI; fallback Temporal tem 45.459 e rótulos compartilhados 624. Os chunks opcionais integram o total, mas não são necessariamente transferidos no primeiro render.

Uma entrada isolada retendo exatamente as primitivas Floating UI mede 45.893 bytes / 16.476 gzip. O popover Calendara isolado mede 47.877 / 17.307, incluindo wrapper/rótulos. Apenas posicionamento com `@floating-ui/react-dom` mede 18.133 / 7.142, mas **não substitui foco, papel acessível ou fechamento**; é uma medição de capacidade menor, não promessa de substituição direta. [Floating UI distingue posicionamento de interações](https://floating-ui.com/docs/react).

`@floating-ui/react` 0.27.20 instalado ocupa 934.317 bytes em `node_modules`; os diretórios react/react-dom/core/dom/utils medidos somam 1.457.084, sem `tabbable`. Diretórios instalados incluem declarações e builds alternativos. Isso não é tamanho de download comprimido nem do `.tgz` Calendara: dependências são instaladas separadamente e o bundler seleciona o código necessário.

A [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API) e o [posicionamento CSS por âncora](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Anchor_positioning) permitem uma implementação menor. Popover fornece top layer e fechamento nativo; âncoras/alternativas para overflow são outra capacidade CSS. A aplicação continua responsável por rótulos acessíveis, foco inicial/de retorno, estado controlado, âncoras removidas e conteúdos interativos próprios. Verifique os recursos exatos na matriz de navegadores alvo, inclusive Safari/Firefox antigos; um selo Baseline de uma API não cobre todos os recursos de âncora.

Recomendação: manter o lazy atual até um protótipo nativo passar teclado, retorno de foco, múltiplos calendários, scroll/zoom aninhado, shadow roots e celular físico. Compare a implementação nativa/fallback completa antes de substituir a dependência. Um híbrido apenas de posicionamento também é candidato; a diferença medida entre primitivas é ~9,3 KB gzip, antes do código substituto de interações. A substituição nativa economiza no máximo o chunk lazy atual de ~16,8 KB antes de adicionar a própria implementação. Nenhuma resolve o custo maior de Temporal/mecanismos compartilhados.

Reproduza na raiz após instalar a fixture fixa descrita em `experiments/bundle-audit/README.md`:

```sh
node experiments/bundle-audit/measure-current.mjs
node experiments/bundle-audit/measure-floating.mjs
```

Os [resultados atuais dos concorrentes](../../experiments/bundle-audit/current-results.json) e [resultados Floating UI](../../experiments/bundle-audit/floating-results.json) registram bytes, versões instaladas e chunks. Scripts gravam em `output/floating-audit`, ignorado pelo Git, sem modificar o bundle da release.

## Por que o pacote apenas com dia continua grande

Uma medição separada de exports retidos identifica a cadeia: `Calendar → calendarApp → expandRange → expandEvent → ruleStarts → RRuleTemporal`. O `rrule-temporal` 2.2.8 contribui com um módulo de 232.945 bytes renderizados antes da minificação final. A classe retida isoladamente ocupa **179.616 bytes minificados / 49.937 bytes gzip**. São tamanhos isolados; não se somam tamanhos comprimidos de módulos para estimar o gzip da entrada.

Essa dependência embute `temporal-polyfill` e escolhe Temporal nativo quando disponível. A Calendara também distribui seu próprio fallback lazy `@js-temporal/polyfill` (**159.673 bytes minificados / 45.459 bytes gzip**). Navegadores sem Temporal nativo precisam, portanto, de duas implementações. Temporal nativo evita transferir o fallback lazy da Calendara, mas o fallback embutido na dependência de recorrência continua no bundle. Passar o namespace Temporal opcional de saída da dependência não elimina a implementação interna. A [documentação de interoperabilidade](https://github.com/ggaabe/rrule-temporal#temporal-implementations-and-interoperability) explica o backend embutido e o processamento não gregoriano.

O mapa de módulos apenas com dia exclui MonthView, ListView e CalendarEventEditor. Inclui `TimeGrid → EventOverflow → lazy MonthMorePopover`: o excesso de eventos temporizados de dia/semana também usa esse popover. Sua presença é intencional e não significa seleção implícita da view de mês. Renomear esse componente compartilhado melhoraria a clareza, sem reduzir o bundle.

Priorize um único backend de recorrência/Temporal antes de dividir pacotes. Avalie o motor de recorrência civil existente contra todo o conjunto de casos zonados, incluindo horários inexistentes no DST, COUNT, exceções e filtros BY*, antes de substituir o backend externo. Uma entrada da dependência para Temporal nativo/injetado sem fallback embutido é outra opção. Carregar recorrência sob demanda adia o custo, mas exige contrato explícito de inicialização/carregamento assíncrono; a expansão síncrona atual não pode simplesmente aguardar um import. Carregamento lazy da rota já é possível. Substituir o popover por APIs nativas afeta o chunk opcional menor e deve passar pela validação de acessibilidade.

Execute `node experiments/bundle-audit/measure-causal.mjs` para atribuição por chunk/módulo e probes isolados. Os [resultados causais](../../experiments/bundle-audit/causal-results.json) preservam a medição; bytes renderizados de módulos são anteriores à minificação final.
