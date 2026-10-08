> Engineering archive / Arquivo de engenharia. Consulte os guias públicos EN/PT para o contrato atual.

# Auditoria de recursos, API e organização — 08/10/2026

Escopo: código local, contratos públicos, documentação oficial e relatos públicos de usuários. Não executamos benchmarks ou suítes nos concorrentes. Relatos antigos não demonstram defeito na versão atual. Esta auditoria complementa os roteiros de personas do documento 08.

## Continuação concluída em 08/10

O [plano SDD](../../specs/calendar-remediation/tasks.md) registra as fatias implementadas e evidências. Foram adicionados `initialView`/`initialDate`, callbacks React de navegação/loading/erro, AbortSignal, reset de opções declarativas, constraints por recurso, arraste externo opt-in e `evaluateEvent` para formulário próprio. O editor permanece independente do calendário. Tema padrão e JSDoc curto EN/PT revisados; o CSS do playground é separado.

A [pesquisa adicional de críticas de API](../../specs/calendar-remediation/api-feedback.md) resultou também em correções de data inicial por fuso, refetch de views e data selecionada no mês compacto. Validação atual: **343 testes em 33 arquivos**, tipos/build/tarball/consumidor/demo e **25 roteiros Edge** aprovados. Logs `output/sdd-verify.log`, `output/sdd-browser.log`, `output/sdd-final-browser.log`; screenshots do tema e arraste inspecionados. O build mantém aviso de chunk acima de 500 KB. As métricas de 322 testes/23 roteiros ao final registram a rodada anterior.

## Conclusão e mudanças aplicadas

Havia acoplamento na seleção: CalendarApp sempre registrava quatro views internas, mesmo recebendo uma lista explícita. A propriedade views significava apenas views extras; remover uma view ativa forçava Semana. Agora views define o conjunto completo, sua ordem e a view inicial quando view está ausente. A substituição preserva a seleção existente se ainda disponível; caso contrário, escolhe a primeira disponível. Lista vazia, nomes duplicados e view inicial não registrada são recusados antes da alteração do registro. registerView continua uma operação imperativa aditiva.

views é obrigatória no React e no controller; BUILTIN_VIEWS é apenas um atalho explícito. A lista precisa conter pelo menos uma definição. O tipo readonly CalendarView[] ainda aceita [] estaticamente; a validação ocorre em execução. Um tipo de tupla não vazia melhora a detecção estática, mas exige estreitamento de arrays construídos dinamicamente; não foi introduzido nesta rodada.

Isso corrige seleção, não carregamento do bundle: o controlador ainda importa o conjunto padrão. Não afirmar que escolher só Dia elimina automaticamente código de Mês. Um ponto de entrada sem defaults ou carregamento sob demanda é uma otimização separada, que precisa medição.

Componentes compartilhados saíram da raiz de views. ResourceDayView e TimelineView agora são arquivos distintos; suas funções e a faixa de dia inteiro compartilhadas ficam em components/ResourcePresentation. As factories aceitam recursos omitidos, permitindo defini-los uma vez na propriedade resources do calendário. O recurso configurado na factory permanece fallback quando a propriedade não é fornecida.

## Uso atual

```tsx
import {
  Calendar, dayView, monthView, createResourceDayView,
  type CalendarEvent, type CalendarResource,
} from '@jacksoncassemiro/calendara';
import '@jacksoncassemiro/calendara/styles.css';

const views = [dayView, monthView, createResourceDayView()];
const resources: CalendarResource[] = [
  { id: 'triagem', title: 'Triagem', capacity: 3 },
  { id: 'coleta', title: 'Coleta', capacity: false },
];
const events: CalendarEvent[] = [];

export function Agenda() {
  return <Calendar views={views} resources={resources} events={events}
    date="2026-10-08" options={{ timeZone: 'America/Sao_Paulo' }} />;
}
```

A toolbar oferece somente Dia, Mês e Recursos. Não é necessário instanciar CalendarApp em um componente React; useCalendar fornece a API imperativa quando necessária. Um calendário com apenas uma view própria também é válido. Para manter o comportamento anterior de acrescentar views, use [...BUILTIN_VIEWS, minhaView].

## Comparação de definição e uso

| Referência | Modelo documentado | Vantagem local | Desvantagem ou melhoria local |
|---|---|---|---|
| [FullCalendar React](https://fullcalendar.io/docs/react) e [opções por view](https://fullcalendar.io/docs/view-specific-options) | Conector React, configuração de views, render hooks JSX e opções por view | Pacote único, views próprias com React nativo e providers da aplicação | Não há overrides públicos de options por view; seria útil Dia com escala ampla e Semana compacta, sem efeitos manuais |
| [Schedule-X React](https://schedule-x.dev/docs/frameworks/react), [configuração](https://schedule-x.dev/docs/calendar/configuration) e [views próprias](https://schedule-x.dev/docs/calendar/advanced/custom-views) | Hook cria app, componente apresenta app, factories compõem views e plugins adicionam funções | Calendar declarativo e createReactView dispensam escrever a view própria em Preact | Recorrência e gestos locais não são módulos opcionais; a API precisa separar melhor configuração inicial de estado observado |
| [Mantine Schedule](https://mantine.dev/schedule/schedule/) | Componente agregado, componentes de view diretos, callbacks de data/view, props por view e header composto | Recursos genéricos com capacidade/buffers, sem exigir o restante do design system | Faltam callbacks React de navegação equivalentes e slots públicos para cabeçalhos/células; customToolbar substitui o header inteiro |
| [react-big-calendar, código público](https://github.com/bigcalendar/react-big-calendar/blob/master/src/Calendar.js) | Views selecionáveis, componentes substituíveis e accessors/localizer para dados | Modelo explícito all-day/timed e fuso preserva semântica temporal | Nosso modelo exige converter dados existentes; não há accessors. A conveniência deve vir de adapters de dados, sem diluir o contrato temporal |
| [Syncfusion Scheduler](https://react.syncfusion.com/api/scheduler/overview/) e [views EJ2](https://ej2.syncfusion.com/react/documentation/schedule/views) | API composicional no produto Pure React; EJ2 usa módulos injetados. São APIs distintas | API menor e capacidade independente da aparência dos eventos | Faltam algumas views, templates e controles de escala. Não misturar exemplos dos dois produtos ao comparar |

## Recursos: estado local e lacunas

| Área | Implementado localmente | Lacuna relevante e prioridade |
|---|---|---|
| Views | Dia, semana, N dias, mês, lista, recursos por dia, timeline por dia, React customizada | Média: WorkWeek com dias ocultos reais, ano, timeline de vários dias. N dias corridos não equivale a WorkWeek |
| Densidade | Lado a lado, sobreposição parcial, scroll ou +mais; popover/componente/view de destino | Média: expandir um grupo dentro da linha; virtualização medida. Não confundir capacidade de reserva com limite visual |
| Movimento | Drag/resize, intervalo multiday integral, duas extremidades, transferência de recurso, preview, recusa/rollback | Alta: auto-scroll e navegação de período durante gesto; atraso de toque; drop externo. Drag/resize por teclado ainda não existe |
| Disponibilidade | Expediente global/próprio de recurso, bloqueios globais, faixas permitidas, capacidade global/individual/ilimitada e buffers | Alta: exceções pontuais por recurso. Indicador mensal fechado é global, não representa lotação de cada sala |
| Recorrência | Quatro frequências, filtros públicos, exceções, overrides, editar ocorrência/série/esta e seguintes | Média: UI de regras ordinais e BYSETPOS; validação de conflitos futuros precisa janela definida. Não representa todo RFC 5545 |
| Recursos | Múltiplos resourceIds, filtro, capacidades e preparação | Média: árvore de recursos, agrupamento e linhas recolhíveis. [DayPilot Resource Tree](https://doc.daypilot.org/scheduler/resource-tree/) é referência concreta |
| Dados remotos | Uma eventSource por range, AbortSignal, callbacks de loading/erro e proteção contra respostas obsoletas | Múltiplas fontes, política de cache e janela adjacente explícita para buffers |
| Estado React | Props iniciais explícitas, callbacks de data/view/range, eventos do consumidor e commits assíncronos recusáveis | `date`/`view` são pedidos ao mudar valor, não controlled estritos; guia descreve essa regra |
| Opções | Props substituem opções declaradas; setOptions aplica patch; slots/escala/rótulos independentes | Opções por view continuam candidatas |
| Customização | Conteúdo React de eventos, toolbar, popovers, decoração de dias e tokens CSS | Média: slots para dia/horário/recurso, indicadores e células; mensagens traduzíveis. locale formata datas, não traduz todos os textos |
| Mobile e acessibilidade | Mês compacto/lista/editor, foco, teclado em slots e overflow horizontal | Alta: toque físico Safari/iOS/Android, NVDA/VoiceOver e contraste/zoom. Viewport pequeno no Edge não é validação física |
| Integrações | Utilitários temporais e contrato de persistência do consumidor | Conforme domínio: ICS, impressão, undo/redo e conectores externos; persistência transacional é responsabilidade do backend |
| SSR | Container inicial e montagem no cliente | Média: documentar explicitamente que não há HTML completo do calendário no servidor; definir necessidade antes de redesenhar |

A [documentação do Syncfusion](https://www.syncfusion.com/scheduler-sdk/react-scheduler) descreve timelines de vários períodos e carregamento virtual. É referência para planejamento, não evidência de desempenho superior aos nossos cenários. [FullCalendar Event Sources](https://fullcalendar.io/docs/event-source) demonstra contratos de múltiplas fontes, loading e falhas que seriam úteis na nossa API.

## Reclamações pesquisadas e implicações

| Relato primário | Contexto observado | Ação para nossa biblioteca |
|---|---|---|
| [FullCalendar #5673](https://github.com/fullcalendar/fullcalendar/issues/5673) | Pedido de virtualização para milhares de recursos e interface lenta | Medir projeção, React/DOM e gestos com volume real; virtualizar recursos quando houver baseline. Não prometer escala por ter poucos rerenders |
| [react-big-calendar #1397](https://github.com/bigcalendar/react-big-calendar/issues/1397) | Sobreposições posteriores ocultando evento anterior | Testar clusters encadeados, eventos contidos e durações diferentes; confirmar acesso a cada evento também em +mais |
| [react-big-calendar #2231](https://github.com/bigcalendar/react-big-calendar/issues/2231) | Arrastar fora do viewport exigia movimentos sucessivos; issue fechada e marcada released | Priorizar auto-scroll, cancelamento e expansão próxima às bordas. Não alegar que o problema continua nessa biblioteca |
| [Schedule-X #1261](https://github.com/schedule-x/schedule-x/issues/1261) | Tipo de timezone restritivo conflitava com o fuso obtido dinamicamente; issue fechada | Manter timeZone string com validação em execução; testar fuso do usuário. Tipagem estrita não deve excluir dados válidos |

Esses casos são exemplos qualitativos, não uma amostra representativa de usuários ou ranking de qualidade. Não foi identificado um conjunto confiável de reclamações específico do Mantine Schedule; não atribuímos defeitos por inferência.

## Organização e padrões de código

```text
src/react/
  viewTypes.ts                    contratos públicos de views e slots
  components/CalendarShell.tsx     moldura e toolbar do calendário
  views/
    MonthView.tsx, ListView.tsx     views de mês e agenda
    ResourceDayView.tsx            recursos em colunas
    TimelineView.tsx               recursos em linhas
    timeGridViews.ts               definições Dia/Semana/N dias
    components/                   renderizadores e componentes compartilhados
    formatting/                   datas, horários e intervalos de preview
    registry/                     defaults e validação do registro
    layout/, models/, hooks/      geometria, projeção e comportamento compartilhado
```

Compartilhar TimeGrid entre Dia/Semana/N dias é reaproveitamento de apresentação, não obrigação de registrar essas views juntas. CalendarView permanece independente de um componente específico. Views interativas próprias ainda precisam cumprir os atributos DOM esperados pelo motor; esse contrato merece guia público antes de prometer extensibilidade completa para gestos.

| Padrão identificado | Tratamento nesta rodada |
|---|---|
| import('...').Tipo espalhado | Consolidado em import type no topo; não era import de execução |
| Import no fim de resourceViews.tsx | Removido ao separar as views; imports dos novos arquivos estão no topo |
| MutableRefObject obsoleto nos tipos React 19 | Substituído por RefObject; handle exposto via useImperativeHandle, sem escrita manual de current |
| Registro/validação duplicados | createViewRegistry concentra lista não vazia e nomes duplicados |
| Fallback silencioso para Semana | Removido; seleção deve pertencer ao registro e remoção usa a primeira disponível |
| Várias responsabilidades em resourceViews | Separadas por view; auxiliares realmente compartilhados ficam em ResourcePresentation |
| Declarações comprimidas | Expandido DayStyleInfo/setDayStyle e corrigida indentação modificada; ainda existem trechos densos em JSX que precisam refatoração por comportamento, não formatação automática indiscriminada |
| Nomes que não comunicam intenção | _oracle.ts agora usa expandRRuleOracle/expandCalendarRule, temporal, recurrenceText, occurrenceLimit, excludedDateISOs e componentes explícitos da data. Os consumidores foram atualizados, preservando as comparações existentes |
| Helpers e unidades ambíguos | draftForResource → getResourceDraftSegment; geometryGridOf → createResourceGeometryGrid; RESOURCE_LABEL_PX → RESOURCE_LABEL_WIDTH_PX; TIMELINE_ROW_PX → TIMELINE_ROW_HEIGHT_PX. Comparação de dados usa leftProperties/rightProperties em vez de a/b |
| Comentários históricos e nomes | Comentários dos arquivos separados ajustados ao papel atual. Ainda revisar referências a fases, adapter e abreviações VM/Geo em nova documentação |
| Carregamento dinâmico do popover | Conservado: é import de execução deliberado, diferente da referência inline de tipo |

Não substituir toda composição por plugins ou criar um pacote por view. Primeiro esclarecer contratos, opções e estado; depois medir bundle e extrair módulos opcionais se houver benefício demonstrado. O pacote permanece único e React nativo.

A revisão de nomes não está concluída no repositório inteiro. Nesta continuação, os cenários de recorrência, constraint.spec.ts, parser.spec.ts e callbacks do CalendarEventEditor foram revisados, junto a outros testes temporais/geométricos. Nomes devem expressar papel, unidade e referencial: occurrenceLimit, minuteOfDay, startDateISO, epochMs, candidatePlacement e resourceCapacity. Um evento com id A/B num teste de geometria pode representar um cenário deliberado; o identificador da variável deve explicar seu papel. Evitar tanto letras isoladas quanto nomes longos que apenas repetem o tipo.

## Duplicação e condições reutilizáveis

Verificar equivalência de intenção e semântica antes de extrair. Uma função reutilizável deve concentrar uma regra, não aceitar dezenas de flags para acomodar views distintas. Condições locais compostas devem nomear a decisão; constantes devem explicitar unidade e significado. JSX parecido não é automaticamente uma duplicação indevida.

| Caso observado | Decisão e estado |
|---|---|
| Chave masterId + originalStart reconstruída em Mês, Lista e Recursos | Corrigido: reaproveitar occurrenceKey, já usado no modelo e overflow; removidos chipKey/itemKey locais idênticos |
| Conversão de startHour/endHour repetida nas extremidades | Corrigido: occurrenceEdges usa resolveHour existente. Condições nomeadas startsInVisibleDay, endsInVisibleDay e endsAtNextMidnight preservam a regra do fim exclusivo |
| Validação de registro no construtor e setViews | Corrigido: createViewRegistry concentra a regra e impede mutação parcial de lista inválida |
| Coluna e timeline com a mesma derivação de draft e faixa all-day | Corrigido: ResourcePresentation compartilha getResourceDraftSegment, createResourceGeometryGrid e ResourceAllDay |
| Ativação de controles personalizados | Já centralizado em isNestedInteractiveTarget, compartilhado entre motor e views; manter os guards de teclado/ponteiro coerentes |
| Classe de validade da prévia e busca de título em várias views | Candidato: compartilhar apresentação do draft, preservando os recortes e posicionamento de cada eixo. Não extraído nesta rodada |
| Alças de resize, estilos de cor, acessibilidade e ocultação da origem | Candidato: componente de superfície de evento com contrato pequeno, mais renderizadores específicos por eixo. Evitar perder data-mc-* necessários ao motor |
| Faixas de dia inteiro do TimeGrid e de Recursos | Compartilham comportamento, mas geometria e agrupamento diferem. Extrair somente operações comprovadamente iguais |
| Callbacks repetidos de Enter/Espaço | Candidato: nomear isActivationKey e regra de alvo próprio; callbacks completos diferem em foco, fechar popover e ação da view |

Critério de aceite para futuras extrações: mesmos horários/IDs, recursos e fim exclusivo; mesma recusa de constraints; controles internos não ativam o pai; teclados e gestos preservados; sem ciclos de importação e sem recalcular geometria por evento desnecessariamente. Reutilizar os testes de integração existentes, acrescentando regressão apenas para uma decisão ainda não coberta.

## Validação

Regressões adicionadas ao teste React existente: seleção exata, primeira view como inicial, ordem, remoção da view ativa, retorno aos defaults, lista inválida e nomes duplicados. Roteiro browser-view-selection-review verifica seleção e calendário com apenas view React própria. A suíte existente cobre os gestos e layouts das views movidas.

Validação final: yarn verify passou com 322 testes em 27 arquivos, tipos, builds, tarball ESM/CJS/CSS e consumidor React TypeScript externo. yarn test:browser passou com 23 roteiros no Edge, incluindo as quatro personas, gestos, recorrência, responsividade e seleção explícita de views. Não houve erros de execução registrados no console da rodada. A imagem view-selection-custom-only.png foi inspecionada: somente a view React própria está disponível.

O pacote gerado também foi consumido com @types/react 18.3.18 e @types/react-dom 18.3.5, em pasta isolada de output, sem skipLibCheck: useCalendar, useRef e createRef aceitos em apiRef. Isso valida tipos de consumo com React 18, não execução dessa versão; o navegador usa React 19. Não foram alteradas as dependências do projeto para esse teste.

Logs: output/api-audit-verify.log, output/api-audit-browser.log e output/react18-types/check.log. O build da demo ainda emite aviso de chunk acima de 500 KB minificado: não foi tratado como falha funcional nem ocultado. Seleção explícita de views não comprovou redução de bundle. Toque físico, leitores de tela e benchmarks de grande escala continuam pendências.
