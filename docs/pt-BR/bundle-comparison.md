# Comparação de bundle e integração

Medição de 08/10/2026. Manter um pacote React. Os resultados apontam uma oportunidade de melhorar o tree shaking interno; não justificam dividir a instalação em vários pacotes.

## Contribuição de JavaScript

Todas as linhas usam Vite 8.3.3 em produção, ES2022 e a mesma exclusão de React/React DOM. CSS fica fora. Os totais incluem todos os chunks JavaScript, comprimidos individualmente. São medidas da contribuição da biblioteca, não do playground, do arquivo npm, da velocidade no navegador ou de recursos avançados equivalentes.

| Cenário | Versão | Bytes minificados | Bytes gzip | Chunks JS |
| --- | --- | ---: | ---: | ---: |
| Calendara: Dia | local 0.1.0 | 513.413 | 142.381 | 3 |
| Calendara: Mês + Dia | local 0.1.0 | 525.084 | 145.208 | 3 |
| Calendara: padrão + recursos + timeline + editor | local 0.1.0 | 553.247 | 151.731 | 3 |
| FullCalendar: Mês + Dia, tema Monarch | React 7.1.1 | 256.315 | 70.580 | 1 |
| Schedule-X: Mês + Dia, Temporal exigido | calendar 4.9.1 / React 4.1.0 | 235.920 | 68.704 | 1 |
| Mantine: Mês + Dia, provider | 9.7.1 | 276.794 | 85.076 | 1 |
| React Big Calendar: Mês + Dia, localizer Day.js | 1.20.0 / Day.js 1.11.23 | 184.318 | 54.871 | 1 |

Mês + Dia da Calendara contém uma entrada de 79.391 bytes gzip, um fallback Temporal de 49.103 e um popover lazy de 16.714. Temporal nativo pode evitar o download do fallback. O popover fechado não precisa carregar seu chunk imediatamente. Comparar o total com uma entrada única do concorrente representa a transferência no pior caso, não uma classificação do custo inicial.

A auditoria inicialmente encontrou `MonthView`, `ListView` e `defaultViews` na configuração de Dia: o controller referenciava `BUILTIN_VIEWS` como fallback quando as views eram omitidas. Dia tinha 145.645 bytes gzip e Mês + Dia tinha 145.652, diferença de apenas 7 bytes. Após retirar esse fallback do controller e exigir definições explícitas, Dia elimina os três módulos e cai para 142.381 bytes. Mês + Dia cai para 145.208: selecionar somente Dia agora economiza 2.827 bytes frente a essa configuração. A [baseline](../../experiments/bundle-audit/baseline.json) preserva as medidas originais.

O popover compartilhado permanece intencionalmente: Dia o usa para acessar eventos excedentes. A implementação de recorrência também permanece sem eventos recorrentes. Adicionar views padrão, recursos, timeline e editor aumenta o total gzip final de Mês + Dia em 6.523 bytes nesta fixture. A maior parte do custo atual é do mecanismo compartilhado, não das views opcionais.

A [receita com lockfile fixado](../../experiments/bundle-audit/README.md) reproduz a comparação. Os [resultados brutos](../../experiments/bundle-audit/results.json) registram tamanhos por chunk e módulos locais mantidos. Calendara usa a entrada pública `src/index.ts` com transformação de produção; este experimento não testa instalação do arquivo de release ou a entrada gerada em `dist`. A compilação Vite valida o bundle; não valida interações ou acessibilidade dos concorrentes.

## Vantagens e desvantagens da integração

| Biblioteca | Integração inicial | Capacidades separadas | Consequência prática |
| --- | --- | --- | --- |
| Calendara | JSX, eventos e definições obrigatórias das views; tema opcional | Um pacote com entrada `/core`; editor pode ficar fora do JSX | Menos decisões de instalação; persistência explícita e contratos de datas precisam de explicação; custo compartilhado de recorrência/runtime permanece |
| FullCalendar 7 | JSX, plugins de views/tema e estilos | Subpaths de plugins no React; Scheduler separado e premium | Seleção precisa de capacidades; plugins, tema e licença acrescentam escolhas |
| Schedule-X | Hook da aplicação, factories de views, wrapper React e estilos | Serviços e interações por plugins; peers Preact/signals e Temporal | Extensibilidade ampla; mais versões e runtimes para alinhar |
| Mantine | Schedule ou views isoladas, provider e estilos Mantine | Pacotes schedule/dates/core/hooks | Conveniente em app Mantine existente; mais configuração sem Mantine; peers atuais exigem React 19.2 |
| React Big Calendar | JSX, localizer, altura explícita e estilos | Addon de drag-and-drop e escolha de localizer | API React familiar e escolha da biblioteca de datas; configuração de localização e geometria obrigatória |

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
