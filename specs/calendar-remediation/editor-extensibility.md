# Editor e pontos de extensão

## Diagnóstico

`Calendar` não monta `CalendarEventEditor`. O editor é exportado separadamente, com `event`, `occurrence`, `validate`, `onSave`, `onDelete` e `onCancel`. No playground, a aplicação possui o `<dialog>`, funções de abertura/fechamento, persistência e escolha do escopo recorrente. Um componente próprio já pode ocupar esse lugar: clique no calendário não exige formulário nem modal.

Os problemas são a repetição de validação na integração e a ausência de slots menores para personalizar o formulário padrão e os cabeçalhos. Adicionar uma prop obrigatória de formulário ao calendário criaria o acoplamento que queremos evitar.

## Referências verificadas

| Biblioteca | Contrato | Consequência para nossa API |
| --- | --- | --- |
| [FullCalendar eventClick](https://fullcalendar.io/docs/eventClick) e [content injection](https://fullcalendar.io/docs/content-injection) | Interação e renderização são extensões diferentes | Não vincular clique automaticamente à edição |
| [Mantine DayView](https://mantine.dev/schedule/day-view/) | Exemplo compõe formulário externo; renderEvent recebe propriedades da superfície | Manter editor externo e documentar conteúdo versus wrapper |
| [Schedule-X React](https://schedule-x.dev/docs/frameworks/react) | Componentes próprios para diversas partes da UI | Oferecer extensões menores sem substituir a view inteira |
| [Schedule-X interactive modal](https://schedule-x.dev/docs/calendar/plugins/interactive-event-modal) | Editor é plugin separado e premium; campos configuráveis | Um modal de detalhes não equivale a um formulário customizável |
| [React Big Calendar, contrato público](https://github.com/bigcalendar/react-big-calendar/blob/master/src/Calendar.js) | Components e wrappers, inclusive por view | Preservar superfície acessível e gestos enquanto troca conteúdo |

Relatos históricos ilustram riscos de contrato, não defeitos atuais confirmados nos concorrentes: [RBC #576](https://github.com/bigcalendar/react-big-calendar/issues/576) discute conteúdo e wrapper; [FullCalendar #3328](https://github.com/fullcalendar/fullcalendar/issues/3328) discute abertura a partir de lista externa; [Schedule-X #1287](https://github.com/schedule-x/schedule-x/issues/1287) relata divergência entre tipos e propriedades de slot. Nossos testes devem verificar as propriedades recebidas em execução, sem simular clique em cartão para abrir editor.

## Decisão desta fatia

- Preservar editor independente e callbacks genéricos de interação.
- Compartilhar `evaluateEvent(event, occurrence?)` na API do calendário, usando regras/ocupação do motor. Tanto o formulário padrão quanto o próprio podem validar um evento completo.
- Corrigir a identidade do editor do playground: mestre + início original, não apenas horário.
- Documentar composição de formulário próprio sem nova dependência.

## Próxima especificação, ainda não implementada

Um hook opcional de editor pode concentrar `openCreate`, `openOccurrence`, `close`, `request`, `pending`, `error` e `submit`. Um comando discriminado (`create`, `update`, `delete`, com escopo) poderá compartilhar persistência entre editor, drag e ações externas. A decisão de alterar ocorrência, próximas ou série precisa ser explícita; não introduzir um comando genérico que apague um mestre por acidente.

Slots futuros: campos adicionais/ações do editor; header de dia/recurso; rótulo de horário; estado vazio; partes da toolbar. Cada slot precisa indicar o que substitui e quais atributos devem ser preservados. O wrapper padrão deve continuar responsável por geometria, alças, acessibilidade e interações. Usuários com React Hook Form, Mantine Form ou estado próprio não precisam adotar o hook opcional.
