# Guia de recursos e cenários demonstráveis

[English](../en/features.md) · [Guia da API](api.md) · [Playground](https://jacksoncassemiro.github.io/calendara/examples/react.html?lang=pt-BR)

O playground é um exemplo de integração em memória. Seus controles demonstram configuração da aplicação; não são uma interface obrigatória da biblioteca. Recarregar restaura os dados. As views padrão são escolhidas explicitamente; Resumo é uma view personalizada de demonstração.

| Fluxo                      | Entrada pública                                                                       | Experimente                                                                                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Semana/dia/período próprio | `weekView`, `dayView`, `createNDaysView`                                              | [Semana](https://jacksoncassemiro.github.io/calendara/examples/react.html?lang=pt-BR&view=week): altere duração, tamanho do slot e intervalo dos rótulos separadamente                                |
| Mês/eventos entre dias     | `monthView`, `monthMaxEvents`, `onMonthMoreClick`, `renderMonthMore`, `monthMoreView` | [Mês](https://jacksoncassemiro.github.io/calendara/examples/react.html?lang=pt-BR&view=month): veja faixas contínuas e escolha o comportamento de +mais                                               |
| Agenda/celular             | `listView`, `createListView`, `useCompactCalendar`                                    | [Agenda](https://jacksoncassemiro.github.io/calendara/examples/react.html?lang=pt-BR&view=list): eventos por data; a aplicação escolhe o modo compacto                                                |
| Recursos                   | `createResourceDayView`, `resources`, `resourceIds`                                   | [Salas](https://jacksoncassemiro.github.io/calendara/examples/react.html?lang=pt-BR&view=resources&scenario=capacity): compare capacidade herdada, local e ilimitada                                  |
| Timeline por recurso       | `createTimelineView`, `pxPerMinute`, `slotMinutes`                                    | [Timeline](https://jacksoncassemiro.github.io/calendara/examples/react.html?lang=pt-BR&view=timeline): tempo horizontal e identificação das salas                                                     |
| Eventos próximos           | `slotEventOverlap`, `timedEventOverflow`, `eventMaxStack`, `renderEventMore`          | [Muitos eventos](https://jacksoncassemiro.github.io/calendara/examples/react.html?lang=pt-BR&view=day&scenario=overflow): lado a lado, sobreposição parcial ou +mais; aparência não altera capacidade |
| Mover/redimensionar/salvar | `onEventDrop`, `onEventResize`, `applyEventTimeChange`                                | Mova/estenda e use a opção de recusar a próxima gravação para conferir rollback                                                                                                                       |
| Entrada/saída de eventos   | `useCalendarDraggable`, `onExternalEventDrop`, `onEventDropOutside`                   | [Transferências](https://jacksoncassemiro.github.io/calendara/examples/react.html?lang=pt-BR&view=day&scenario=external-drag): arraste um modelo para dentro e um evento para a área externa          |
| Recorrência/editor         | `recurrence`, `CalendarEventEditor`, `evaluateEvent`, `splitEventSeries`              | [Recorrência](https://jacksoncassemiro.github.io/calendara/examples/react.html?lang=pt-BR&view=day&scenario=recurrence): edite repetição e escopo da ocorrência/série                                 |
| View/conteúdo próprios     | `createReactView`, `renderEvent`, `customToolbar`                                     | [Resumo](https://jacksoncassemiro.github.io/calendara/examples/react.html?lang=pt-BR&view=summary) pertence ao exemplo, não às views embutidas                                                        |
| Estilo/status              | CSS opcional, `event.color`, `getDayStyle`                                            | Cor é apresentação; pintar o dia não o torna indisponível                                                                                                                                             |

## Quem salva uma transferência

O arrasto de entrada propõe `change.event`; a aplicação insere e persiste via `onExternalEventDrop`. Use ID próprio e evento sem regra de recorrência. A saída identifica a ocorrência original, sem excluir automaticamente. Em eventos recorrentes, decida explicitamente entre remover uma ocorrência ou a série. Não há DataTransfer HTML entre documentos nem transferência automática entre calendários.

```tsx
function Modelo({ event }: { event: CalendarEvent }) {
  const drag = useCalendarDraggable(event);
  return (
    <button {...drag} style={{ touchAction: 'none' }}>
      {event.title}
    </button>
  );
}

<Calendar
  views={views}
  events={events}
  onExternalEventDrop={async (change) => {
    await salvarEvento(change.event);
    setEvents((current) => [...current, change.event]);
  }}
  onEventDropOutside={abrirDialogoTransferencia}
/>;
```

Importe o hook e o tipo `CalendarEvent` do pacote. Persistência, estado e diálogo pertencem à aplicação. Ofereça ações equivalentes de criação/edição por teclado; arrastar não deve ser o único acesso.

## Limites e próximas views possíveis

Ainda não há grade anual/trimestral, timeline de recursos de múltiplos dias, árvore agrupada de recursos, virtualização, impressão/PDF, ICS, undo/redo ou RTL completo. Não prometemos todo o RFC 5545 nem validação em Safari/celulares físicos. Uma nova view deve resolver uma tarefa concreta, não apenas copiar menus.

Para agenda operacional, agrupamento de salas e timeline de vários dias são próximos candidatos úteis. Grade anual ajuda no planejamento de férias; impressão atende fluxos em papel. [FullCalendar Premium](https://fullcalendar.io/docs/premium) documenta timelines de recursos e impressão; [plugins do Schedule-X](https://schedule-x.dev/docs/calendar/plugins) separam extensões. São referências de prioridade, não promessas de paridade. Mantine oferece [componentes de agenda isolados](https://mantine.dev/schedule/getting-started/); [React Big Calendar](https://github.com/bigcalendar/react-big-calendar#readme) separa exemplos, localizers e addons.

A navegação segue essa divisão prática: primeiro calendário, integração, cenários ao vivo, contratos gerados, comparação medida e limites claros. Veja [medidas dos pacotes](bundle-comparison.md) antes de decidir separações.
