# Revisão de arquitetura, recursos e experiência

Consulta às fontes primárias em 07/10/2026. Recursos declarados pelos fornecedores não foram testados nos seus produtos. Este documento distingue recursos existentes, validações locais e propostas.

## Arquitetura para React

Preact pode renderizar um calendário dentro de um componente React, desde que cada reconciliador seja dono de uma região do DOM. Isso permite reutilizar as views em outras tecnologias. Entretanto, a escolha de Preact não garante estabilidade nem elimina recomputações: props, subscriptions, identidade dos dados, gestão dos gestos e concorrência continuam precisando de testes.

Hoje os motores puros estão separados de views, mas o pacote core também exporta o renderer Preact. A fronteira desejável é um motor independente (datas, recorrência, constraints, ocupação e geometria), um renderer e a integração React. Não precisamos desenvolver novos adapters agora.

O adapter anterior criava uma raiz React por evento/toolbar/view personalizada. Uma raiz independente não herda o contexto do aplicativo. Nesta revisão, as três extensões passaram a usar portals pertencentes à árvore React do consumidor, conforme a [documentação React](https://react.dev/reference/react-dom/createPortal), com teste de atualização de provider. Como a compatibilidade atual pode ser quebrada e React é prioritário, a direção recomendada é renderer React nativo, reaproveitando os motores. Essa migração ainda não foi implementada; não há baseline que prove vantagem de velocidade do Preact neste projeto.

A premissa antiga sobre problemas inevitáveis do FullCalendar React deve ser retirada: a [documentação atual de FullCalendar v7](https://fullcalendar.io/docs/react) descreve renderer React próprio, props reativas, StrictMode e views escritas em React. A experiência histórica da aplicação com v6 não demonstra o comportamento de v7.

## Comparação de recursos

Referências adicionais: [Mantine Schedule](https://mantine.dev/schedule/schedule/) oferece componente simples, estado controlado, props específicas por view e cabeçalho composto; [ResourcesSchedule](https://mantine.dev/schedule/resources-schedule/) agrega views de recursos. Seu [MobileMonthView](https://mantine.dev/schedule/mobile-month-view/) combina indicadores no mês com lista do dia selecionado e não oferece drag nessa view. Esse é um padrão útil de adaptação, não uma justificativa para exigir drag em toda tela.

[KendoReact Scheduler](https://www.telerik.com/kendo-react-ui/components/scheduler) entra como referência de integração com um sistema de componentes React. [ilamy](https://ilamy.dev/) entra como contraponto de calendário React com Tailwind/shadcn e plugins opcionais. A afirmação comercial de tamanho/desempenho do fornecedor não foi medida aqui. Adotar o desenho de uma API simples não exige adotar suas dependências visuais.

| Área | Referências | Situação local e critério de aceite |
|---|---|---|
| Dia, semana, mês e lista | FullCalendar, Schedule-X, React Big Calendar, Bryntum, Syncfusion | Existem. Validar navegação, callbacks e continuidade de eventos em todas as views |
| N dias / views próprias | [FullCalendar React](https://fullcalendar.io/docs/react), [React Big Calendar](https://github.com/bigcalendar/react-big-calendar) | Factories e createReactView existem; hooks e context React devem funcionar |
| Recursos e timeline | [FullCalendar](https://fullcalendar.io/docs/react), [Syncfusion](https://ej2.syncfusion.com/react/documentation/schedule/resources), [Bryntum](https://bryntum.com/products/calendar/features/) | Existem; transferência precisa preservar demais resourceIds e validar capacidade, buffer e expediente |
| Recorrência e exceções | [FullCalendar](https://fullcalendar.io/docs/recurring-events), [Schedule-X](https://schedule-x.dev/docs/calendar/plugins/recurrence) | Motor próprio: DAILY/WEEKLY/MONTHLY/YEARLY. Não chamar de RFC completo: subdiário e demais filtros não cobertos precisam contrato explícito |
| Drag/resize entre dias | [Schedule-X](https://schedule-x.dev/docs/calendar/plugins/drag-and-drop), Bryntum | Não basta renderizar segmentos: preservar duração integral, validar cada dia, fazer rollback isolado e editar exceção recorrente |
| Mobile / toque | [FullCalendar](https://fullcalendar.io/docs/touch), [Schedule-X](https://schedule-x.dev/docs/calendar/views), [Syncfusion](https://ej2.syncfusion.com/react/documentation/schedule/resources) | Layout sem overflow foi verificado em 320/375/768px. Rolagem nativa, seleção e edição por toque precisam testes próprios |
| Editor / exclusão / recorrência | [Bryntum](https://bryntum.com/products/calendar/features/) | Editor React de demonstração pertence ao exemplo. Editor reutilizável opcional ainda precisa implementação e validação |
| Ano / multimestre / semana útil | FullCalendar e Bryntum | Backlog: views adicionais, dias ocultos e número de semana |
| Filtros / seleção de recursos | Bryntum e Syncfusion | visibleResourceIds existe; filtro de eventos e seletor acessível mobile precisam interface |
| Teclado / leitor de tela | [FullCalendar](https://fullcalendar.io/docs/accessibility) | Foco, nomes e ativação precisam cobertura. Drag por ponteiro sozinho não oferece alternativa de teclado |
| Grandes datasets | [FullCalendar virtual rendering](https://fullcalendar.io/docs/virtual-rendering) | Sem virtualização. Medir eventos e recursos antes de escolher estratégia |
| Undo/redo, clipboard, drag externo | [Bryntum](https://bryntum.com/products/calendar/features/), [Syncfusion API](https://ej2.syncfusion.com/react/documentation/api/schedule/) | Ainda ausentes. Implementar como módulos opcionais com transações verificáveis |
| ICS, impressão, exportação | [Bryntum](https://bryntum.com/products/calendar/) | Ainda ausentes. Separar serialização, layout de impressão e integração externa |
| RTL / temas / localization | FullCalendar, Bryntum | Locale já existe. RTL, dark mode e timezone DST devem ter casos explícitos |

“Todos os recursos dos concorrentes” é uma direção de cobertura, não uma alegação de paridade atual. Os produtos diferem entre si, e recursos premium, editores e integrações aumentam o escopo. A matriz deve crescer com critérios de aceite e testes; nenhuma etapa está concluída apenas porque aparece no catálogo.

## Evidências locais desta revisão

`yarn verify`: 250 testes em 21 arquivos, tipos, builds ESM/CJS/declarations, tarballs e consumidor React TypeScript. `yarn test:browser`: 19 verificações de fluxo no Edge, incluindo edição/criação, drag/resize, rejeição/rollback, filtro/conflito de recursos e remontagem StrictMode; 18 combinações de view/largura (320/375/768px).

Benchmark `node scripts/bench.mjs 2000 3`, pipeline headless semanal com polyfill: aproximadamente 2.240 ms antes de cachear limites da janela e evitar conversões para a mesma timezone; aproximadamente 1.384 ms na execução após a mudança. São três amostras locais, sem isolamento de carga, e não uma comparação rigorosa de frameworks. O custo ainda é alto para agendas densas; otimizar projeções/reutilização dos dados e medir diferentes quantidades de eventos/recursos é prioridade antes de afirmar boa performance. Virtualização de DOM sozinha não elimina esse custo do motor.

## Simplicidade de uso

O fluxo básico deve exigir somente `<Calendar events={events} />` e um import de CSS. Recursos avançados entram por props tipadas, factories de views e callbacks. O consumidor não deve precisar conhecer Preact, criar plugins obrigatórios para funções básicas, escrever diff de eventos ou gerenciar listeners de ponteiro.

O contrato precisa esclarecer estado controlado versus estado inicial, fonte assíncrona versus events, política de concorrência, zona dos horários nos callbacks e escopo de edição recorrente. A API imperativa deve continuar opcional. Um editor pronto pode ser um componente React separado, customizável e sem obrigar regras de domínio.

## CSS, CSS Modules e Tailwind

Recomendação para este passe: manter CSS distribuído pronto, escopado em `[data-mc-root]`, com tokens `--mc-*`. É consumível sem configuração por React e outras tecnologias, permite personalização e não exige o mesmo gerador CSS do aplicativo.

[CSS Modules](https://vite.dev/guide/features.html#css-modules) ajudam no isolamento de classes internas, mas exigem compilar e distribuir o mapeamento juntamente com JS/CSS. Não resolvem tamanho de alvos, hierarquia, cores, rolagem ou regras de responsividade. Podem ser adotados no renderer futuro se colisões reais justificarem a migração; manter tokens e atributos data como contrato público.

[Tailwind](https://tailwindcss.com/docs/detecting-classes-in-source-files) pode ser usado pelo aplicativo consumidor e pelos slots React. A detecção de classes exige atenção aos arquivos de dependências e nomes dinâmicos; distribuir CSS pré-compilado evita impor configuração ao consumidor. Não tornar Tailwind obrigatório no núcleo. Ele não muda a lógica de layout nem oferece por si só uma experiência adequada no celular.

## Saída para celular

Usar a largura do container, não apenas a viewport: o calendário pode estar dentro de um painel estreito em desktop. A política deve ser explícita e configurável:

1. Preferir Dia ou Agenda em containers estreitos; permitir que o usuário escolha a grade quando precisar.
2. Toolbar compacta, navegação de data e seletor de view em vez de oito botões permanentes.
3. Recursos por seletor, com um recurso ou poucos visíveis; timeline ampla continua disponível com rolagem interna.
4. Toque abre o editor com início/fim e recurso. Reagendar precisa funcionar sem drag.
5. Rolagem nativa deve prevalecer sobre gesto acidental. Long press para drag só pode ser declarado suportado depois de validação de touch/pointercancel.
6. Mês compacto deve destacar ocupação e abrir lista do dia; empilhar títulos ilegíveis em células de 40px não resolve a tarefa.

Testes no Edge desktop com viewport pequena comprovam dimensões, não a ergonomia em iOS/Android. Validar em dispositivos e leitores de tela antes de afirmar suporte mobile completo.
