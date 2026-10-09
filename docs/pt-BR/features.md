# Guia de recursos e cenários demonstráveis

[English](../en/features.md) · [Guia da API](api.md) · [Playground](https://jacksoncassemiro.me/calendara/examples/react.html?lang=pt-BR)

O playground é um exemplo de integração em memória. Seus controles demonstram configuração da aplicação; não são uma interface obrigatória da biblioteca. Recarregar restaura os dados. As views padrão são escolhidas explicitamente; Resumo é uma view personalizada de demonstração.

| Fluxo                                   | Entrada pública                                                                       | Experimente                                                                                                                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Semana/dia/período próprio              | `weekView`, `dayView`, `createNDaysView`                                              | [Semana](https://jacksoncassemiro.me/calendara/examples/react.html?lang=pt-BR&view=week): altere duração, tamanho do slot e intervalo dos rótulos separadamente                                |
| Mês/eventos entre dias                  | `monthView`, `monthMaxEvents`, `onMonthMoreClick`, `renderMonthMore`, `monthMoreView` | [Mês](https://jacksoncassemiro.me/calendara/examples/react.html?lang=pt-BR&view=month): veja faixas contínuas e escolha o comportamento de +mais                                               |
| Agenda/celular                          | `listView`, `createListView`, `useCompactCalendar`                                    | [Agenda](https://jacksoncassemiro.me/calendara/examples/react.html?lang=pt-BR&view=list): eventos por data; a aplicação escolhe o modo compacto                                                |
| Recursos                                | `createResourceDayView`, `resources`, `resourceIds`                                   | [Salas](https://jacksoncassemiro.me/calendara/examples/react.html?lang=pt-BR&view=resources&scenario=capacity): compare capacidade herdada, local e ilimitada                                  |
| Timeline por recurso                    | `createTimelineView`, `pxPerMinute`, `slotMinutes`                                    | [Timeline](https://jacksoncassemiro.me/calendara/examples/react.html?lang=pt-BR&view=timeline): tempo horizontal e identificação das salas                                                     |
| Eventos próximos                        | `slotEventOverlap`, `timedEventOverflow`, `eventMaxStack`, `renderEventMore`          | [Muitos eventos](https://jacksoncassemiro.me/calendara/examples/react.html?lang=pt-BR&view=day&scenario=overflow): lado a lado, sobreposição parcial ou +mais; aparência não altera capacidade |
| Mover/redimensionar/salvar              | `onEventDrop`, `onEventResize`, `applyEventTimeChange`                                | Mova/estenda e use a opção de recusar a próxima gravação para conferir rollback                                                                                                                |
| Entrada/saída de eventos                | `useCalendarDraggable`, `onExternalEventDrop`, `onEventDropOutside`                   | [Transferências](https://jacksoncassemiro.me/calendara/examples/react.html?lang=pt-BR&view=day&scenario=external-drag): arraste um modelo para dentro e um evento para a área externa          |
| Recorrência/editor                      | `recurrence`, `CalendarEventEditor`, `evaluateEvent`, `splitEventSeries`              | [Recorrência](https://jacksoncassemiro.me/calendara/examples/react.html?lang=pt-BR&view=day&scenario=recurrence): edite repetição e escopo da ocorrência/série                                 |
| View/conteúdo próprios                  | `createReactView`, `renderEvent`, `customToolbar`                                     | [Resumo](https://jacksoncassemiro.me/calendara/examples/react.html?lang=pt-BR&view=summary) pertence ao exemplo, não às views embutidas                                                        |
| Estilo/status                           | CSS opcional, `event.color`, `getDayStyle`                                            | Cor é apresentação; pintar o dia não o torna indisponível                                                                                                                                      |
| Hierarquia e listas grandes de recursos | `createResourceTimelineView`, `parentId`, `hierarchy`, `virtualization`               | Configure linhas aninhadas e renderização vertical automática no [guia de views ampliadas](extended-views.md).                                                                                 |
| Importação/exportação                   | `importICalendar`, `exportICalendar` de `/core`                                       | Leia o [guia ICS](ics.md), revise diagnósticos e deixe a aplicação salvar ou baixar o resultado.                                                                                               |
| Desfazer/refazer                        | `useCalendarHistory`                                                                  | Conecte alterações aceitas ao histórico do consumidor com persistência assíncrona opcional; veja [histórico](history.md).                                                                      |

## Quem salva uma transferência

Defina `options.direction` para layout LTR/RTL independentemente do locale; veja [direção e cobertura de interação](rtl.md). A opção não traduz o editor do consumidor nem certifica cada renderer próprio.

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

## Cobertura e limites

Grades de ano/trimestre, planejador anual, agenda do dia, timelines de vários dias, linhas aninhadas de recursos, virtualização vertical da timeline e impressão pelo navegador estão disponíveis por registro explícito de views. [Views ampliadas](extended-views.md) explica a configuração. A impressão pode usar Salvar como PDF do navegador; não há API de exportação binária de PDF.

[Recorrência](recurrence.md) cobre as sete frequências, filtros de horário e números de semana anuais, com limites explícitos de expansão. [ICS](ics.md) é um adaptador de subconjunto estrito com diagnósticos, em vez de implementação completa de convites/CalDAV. [Histórico](history.md) registra snapshots dos eventos do consumidor, sem desfazer transações do servidor automaticamente. Virtualização horizontal, cache de projeções e validação física em Safari/celular ou com leitor de tela continuam fora da cobertura demonstrada.

A documentação começa com o primeiro calendário e separa guias de integração, cenários focados, contratos gerados e comparações medidas. A organização segue a divisão prática da [documentação FullCalendar](https://fullcalendar.io/docs), do [guia de plugins Schedule-X](https://schedule-x.dev/docs/calendar/plugins) e do [setup de componentes Mantine](https://mantine.dev/schedule/getting-started/); não implica paridade de recursos. Veja [medidas dos pacotes](bundle-comparison.md) antes de decidir separações.

### Limites atuais e mitigação

| Área                 | Limite concreto                                                                                      | Mitigação / contrato                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Editor padrão        | Padrão EN/PT; outros idiomas por `messages` e Intl `locale`.                                         | Use formulário próprio pelos callbacks e `evaluateEvent`; [API](api.md).                            |
| Recorrência          | Até 50.000 períodos e 100.000 candidatos por período; erro ao exceder.                               | Reduza a janela/filtros; [combinações e limites](recurrence.md).                                    |
| ICS                  | Entrada até 5 MiB de unidades UTF-16; sem VTIMEZONE, alarmes, convites ou CalDAV.                    | Adaptador externo para esses formatos; revise diagnósticos; [campos suportados/rejeitados](ics.md). |
| Virtualização        | Apenas linhas da timeline de recursos; sem janela horizontal ou cache de projeções.                  | Ative `virtualization`, restrinja período/recursos carregados; [configuração](extended-views.md).   |
| Histórico            | 50 snapshots por direção por padrão; só eventos da sessão.                                           | Configure `limit` e `persist`; coordene concorrência no servidor; [histórico](history.md).          |
| PDF                  | Impressão/Salvar como PDF do navegador; sem exportação binária.                                      | Use `api.print` ou exportador do consumidor; [impressão](extended-views.md).                        |
| Arraste externo      | Integração dentro do documento; sem transferência automática entre calendários/documentos.           | Inserção/remoção via callbacks e ações equivalentes por teclado.                                    |
| RTL e acessibilidade | Direção configurável; componentes próprios e celular/Safari/leitor de tela físicos não certificados. | Respeite `dir` nos renderers e valide nos dispositivos-alvo; [cobertura RTL](rtl.md).               |

Esses limites continuam vigentes. Views ampliadas, hierarquia, virtualização vertical, histórico, ICS e RTL básico já estão implementados dentro desses contratos; recursos fora deles não são garantidos.
