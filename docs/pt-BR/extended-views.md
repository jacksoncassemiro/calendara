# Views ampliadas

[English](../en/extended-views.md)

Registre cada view explicitamente. As views adicionais não alteram `BUILTIN_VIEWS`, que continua como atalho de semana/dia/mês/lista.

Os cartões se ajustam à largura medida de cada painel mensal, inclusive calendários lado a lado. `monthMaxEvents` é um limite superior (padrão 3); células estreitas reduzem os cartões gradualmente até manter apenas a data e a contagem de +mais. `monthMaxEvents: false` preserva cartões ilimitados. Eventos ocultos mantêm o comportamento de `onMonthMoreClick`, `renderMonthMore` e `monthMoreView`; isso não ativa o modo compacto opcional de seletor de datas.

Os painéis de mês, ano e trimestre exibem seis semanas por padrão. Use `options={{ monthFixedWeeks: false }}` para quatro a seis semanas conforme o mês. Carregue todo o intervalo visível informado, incluindo datas de meses adjacentes. As linhas do planejamento anual mantêm altura uniforme e um scrollbar superior sincronizado; sua largura de dia pode ser estilizada por `--mc-year-day-width` (padrão 120px).

```tsx
import {
  Calendar,
  createResourceView,
  createResourceTimelineView,
  yearView,
  quarterView,
  yearPlannerView,
  dayAgendaView,
} from '@jacksoncassemiro/calendara';
import '@jacksoncassemiro/calendara/styles.css';

const resources = [
  { id: 'building-a', title: 'Prédio A' },
  { id: 'room-a', title: 'Sala A', parentId: 'building-a', capacity: 1 },
  { id: 'team-b', title: 'Equipe B' },
];

const resourceWeek = createResourceView({
  name: 'resource-week',
  days: 7,
  alignment: 'week',
  groupBy: 'resource',
});
const timelineMonth = createResourceTimelineView({
  name: 'timeline-month',
  duration: 'month',
  dayWidth: 240,
  groupBy: (resource) => (resource.id.startsWith('team') ? 'Equipes' : 'Salas'),
  collapsedGroups: ['Equipes'],
  hierarchy: true,
  collapsedResourceIds: ['building-a'],
  virtualization: { height: 320, overscan: 4 },
});

<Calendar
  views={[resourceWeek, timelineMonth, yearView, quarterView, yearPlannerView, dayAgendaView]}
  initialView="resource-week"
  resources={resources}
  events={events}
/>;
```

| View                 | Configuração e limites                                                                                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recursos verticais   | `createResourceView({ days, alignment, groupBy })`: agrupamento externo por data/recurso; disponibilidade e capacidade continuam por recurso.                          |
| Timeline de recursos | `duration: 'day' \| 'week' \| 'month'`, faixas diárias com data e grupos recolhíveis definidos pelo consumidor; ocorrências completas mantêm identidade entre trechos. |
| Vários meses         | `createMultiMonthView({ months, alignment })`: 1–24 painéis mensais; `yearView` e `quarterView` são opções prontas.                                                    |
| Planejador anual     | Meses em linhas, datas em colunas, indicadores de eventos e callbacks; sem arrastar ou redimensionar nessa visão geral.                                                |
| Agenda do dia        | Cartões cronológicos com informações dos recursos; alterações usam o editor do consumidor.                                                                             |

`dayWidth` da timeline usa pixels e deve ser no mínimo 180; os padrões são 720 para semana/dia e 480 para mês. Cada faixa de data mantém uma coluna de dia inteiro de 64 px e um eixo de horários visível. Timelines apresentam faixas por data em vez de uma única barra contínua entre dias.

Com `hierarchy: true`, valores de `parentId` dos recursos formam linhas aninhadas; `collapsedResourceIds` define os pais inicialmente recolhidos. Clicar em um pai alterna seus descendentes. Pais mantêm regras próprias: filhos não herdam capacidade, buffers nem ocupação do pai. Ciclos lançam erro; recurso cujo pai está ausente é tratado como raiz. `groupBy` do consumidor continua como mecanismo separado de agrupamento em um nível; mantenha pais e descendentes no mesmo grupo, pois a hierarquia é resolvida dentro de cada grupo.

`virtualization: { height, overscan }` habilita renderização vertical automática de linhas de recursos em uma área de scroll limitada. `height` usa pixels, com mínimo de 120; `overscan` é inteiro não negativo e tem padrão de quatro linhas extras por borda. A altura lógica dos espaçadores representa todas as linhas lógicas visíveis, inclusive fora do DOM. Botões de título dos recursos suportam ArrowUp/ArrowDown entre janelas renderizadas. Recolher um pai altera as linhas lógicas, sem excluir recursos da validação de agendamento.

O cenário de navegador com 500 recursos, área de scroll de 320 px e overscan 2 montou no máximo 20 linhas e manteve altura de scroll de 22.103 px. A validação de capacidade continuou rejeitando uma reserva sobreposta no último recurso fora da tela; o scroll revelou seu evento, e ArrowUp no título desse recurso focou o título anterior. Isso demonstra renderização limitada e validação preservada nesse cenário desktop; não é benchmark de CPU, taxa de quadros, celular físico ou leitor de tela. Veja [evidências e limites de virtualização](../../specs/extended-views/virtualization.md).

Colunas de data/horário não são virtualizadas, e essa opção não adiciona cache de projeções diárias/recorrências. Busca do navegador e consultas ao DOM veem somente linhas montadas. `resourceWindow: { start, count }` continua como recorte manual separado **após** filtrar/ordenar recursos; restringe a entrada lógica e não acompanha scroll. Remova-o quando a área de scroll precisar abranger todos os recursos. A impressão deriva eventos de todo o período solicitado, independentemente das linhas montadas da timeline.

Painéis mensais reutilizam a ação de ver mais, conteúdo personalizado e estilos por data. Nomes das views devem ser únicos no registro. Persistência, edição de recorrência e validação de disponibilidade no servidor continuam sob responsabilidade do consumidor.

Use o [guia de recorrência](recurrence.md) para limites de expansão, [histórico do consumidor](history.md) para desfazer/refazer e [ICS](ics.md) para arquivos; esses contratos de integração se aplicam independentemente da view selecionada.

## Largura dos dias no ano

Para layout espelhado, configure `options.direction` e siga o [guia RTL](rtl.md), incluindo propriedades lógicas nos estilos e conteúdos do consumidor.

O tema opcional dá aproximadamente 120 px a cada dia do planejador anual e permite scroll horizontal. Títulos ficam em uma linha com reticências; o título completo continua no nome acessível e tooltip. Ajuste por calendário, por exemplo `[data-mc-root] { --mc-year-day-width: 160px; }`, se precisar de mais espaço para títulos longos. Essa configuração vale para o planejador anual, independentemente de `dayWidth` da timeline.

## Impressão

Chame `api.print({ title: 'Agenda', orientation: 'landscape' })` em uma ação explícita do usuário. O método abre um layout de impressão e o fluxo de impressão do navegador. Escolha **Salvar como PDF** quando disponível. Isso não gera nem baixa bytes de PDF por uma API de exportação.

Os [exemplos focados](../../examples/features.html) cobrem recursos por semana, timelines agrupadas, ano/trimestre, planejador e agenda do dia. O playground geral registra essas views explicitamente para exploração.
