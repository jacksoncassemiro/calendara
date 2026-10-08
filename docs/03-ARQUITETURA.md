# 03 — Arquitetura atual

A biblioteca é um único pacote, @meucalendario/calendar, com renderização React nativa. React e React DOM são peer dependencies (18/19); o build não inclui uma cópia própria desses runtimes. Não há renderer Preact nem monorepo de adapters.

## Responsabilidades

- src/core/types: contratos de eventos, recursos, recorrência e constraints.
- src/core/date, recurrence, geometry, constraint e render: projeção temporal, expansão, disposição e disponibilidade. O nome render neste núcleo designa derivação de dados; não componentes React.
- src/core/interaction: Pointer Events, seleção, movimento, redimensionamento e validação dos rascunhos.
- src/react/app/calendarApp.ts: coordenação de estado, views, expansão, commits e integração do motor de interação com React.
- src/react/Calendar.tsx e hooks: API declarativa para aplicações React.
- src/react/CalendarEventEditor.tsx: formulário opcional; persistência e validação são callbacks do consumidor.
- src/react/views: componentes e definições das views.
- src/react/viewTypes.ts: contrato público das views e slots, sem renderer específico.
- src/react/components: moldura do calendário; src/react/views/components: componentes compartilhados entre views.
- src/react/views/formatting e registry: formatação e configuração/validação das views disponíveis.
- src/react/views/layout: geometria de apresentação, segmentos multiday e políticas de densidade.
- src/react/views/models: modelo de apresentação do time-grid e sua construção.
- src/react/views/hooks: comportamento compartilhado de cabeçalhos e conteúdo durante rolagem.
- styles.css: estilos isolados por classes mc-* e tokens CSS.

A separação entre core e react é de responsabilidades internas, não de pacotes. A entrada ./core permite consumir utilitários de dados sem importar as views. Layout/models/hooks não são novos pontos de entrada públicos.

## Atualização e interação

O estado controlado pertence ao aplicativo consumidor. Alterações aceitas são aplicadas de forma otimista; callbacks podem recusá-las. O rollback conserva alterações posteriores que já não pertencem à operação recusada. Isso não substitui validação transacional de capacidade no servidor.

Movimento e resize usam rascunhos separados dos eventos salvos. A renderização oculta a origem durante a prévia e usa a ocorrência completa, mesmo quando o segmento visível está recortado por dia, semana ou janela de horários. Capacidade, buffers e constraints são avaliados antes do commit.

A recorrência de produção usa rrule-temporal 2.2.8. Temporal é carregado pelo mecanismo existente; os experimentos do iterador civil permanecem separados. Editor e motor não são a mesma responsabilidade: a UI apresenta campos comuns e conserva cláusulas avançadas que não foram editadas.

## Extensibilidade e manutenção

Views implementam CalendarView: nome, label, range, navegação, título e renderização React. Slots de eventos, toolbar e popovers recebem contexto e podem retornar conteúdo React. Recursos e capacidades permanecem dados configuráveis, sem regras específicas de clínicas embutidas no pacote.

Mantenha helpers junto à responsabilidade que atendem. Uma extração deve remover repetição ou esclarecer limites, não criar um arquivo por expressão. Evite abreviações ambíguas em novas funções públicas; preservam-se os nomes públicos já documentados. ResourceGrid reutiliza a densidade calculada no componente pai, e o modelo do time-grid calcula os limites de resize uma vez por evento.

ResourceDayView.tsx e TimelineView.tsx são arquivos distintos; auxiliares realmente compartilhados ficam em components/ResourcePresentation.tsx. A propriedade views seleciona o conjunto completo: omitida usa BUILTIN_VIEWS; informada precisa conter ao menos uma view. Sem view inicial explícita, usa a primeira da lista. Seleção de views não equivale a carregar apenas seus módulos no bundle. Consulte 09-AUDITORIA-API-E-VIEWS.md para decisões, comparações e lacunas; quantidade de testes não prova ausência de rerenders ou de bugs.
