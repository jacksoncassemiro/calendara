# Views ampliadas

[English](../en/extended-views.md)

Registre cada view explicitamente. As views adicionais não alteram `BUILTIN_VIEWS`, que continua como atalho de semana/dia/mês/lista.

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
  groupBy: (resource) => (resource.id.startsWith('room') ? 'Salas' : 'Equipes'),
  collapsedGroups: ['Equipes'],
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

`dayWidth` da timeline usa pixels e deve ser no mínimo 180; os padrões são 720 para semana/dia e 480 para mês. Cada faixa de data mantém uma coluna de dia inteiro de 64 px e um eixo de horários visível. `resourceWindow: { start, count }` seleciona um recorte explícito **após** filtrar/ordenar recursos. Limita linhas renderizadas, mas não acompanha a posição do scroll nem oferece virtualização automática. O agrupamento tem um nível, não uma árvore aninhada. Timelines apresentam faixas por data em vez de uma única barra contínua entre dias.

Painéis mensais reutilizam a ação de ver mais, conteúdo personalizado e estilos por data. Nomes das views devem ser únicos no registro. Persistência, edição de recorrência e validação de disponibilidade no servidor continuam sob responsabilidade do consumidor.

## Impressão

Chame `api.print({ title: 'Agenda', orientation: 'landscape' })` em uma ação explícita do usuário. O método abre um layout de impressão e o fluxo de impressão do navegador. Escolha **Salvar como PDF** quando disponível. Isso não gera nem baixa bytes de PDF por uma API de exportação.

Os [exemplos focados](../../examples/features.html) cobrem recursos por semana, timelines agrupadas, ano/trimestre, planejador e agenda do dia. O playground geral registra essas views explicitamente para exploração.
