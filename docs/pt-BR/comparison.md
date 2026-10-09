# Escolher uma agenda

[English](../en/comparison.md) · Revisado em 8 de outubro de 2026

Esta comparação descreve contratos de integração, não uma pesquisa de usabilidade medida. Menos linhas não comprovam experiência melhor.

| Tarefa                 | Calendara                                                                | Ponto de integração                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Agenda mínima          | Pacote único, CSS, eventos React e views selecionadas explicitamente     | FullCalendar usa adaptador React e plugins de views. Mantine combina com aplicativos que já usam seu ecossistema. RBC exige localizer de datas. |
| Salvar movimento       | Callback, rejeição/rollback assíncrono e `applyEventTimeChange` imutável | Toda biblioteca ainda exige persistência do app. Deixe claros estado/erros, evitando autoridades locais/remotas concorrentes.                   |
| Salas e capacidade     | IDs de recursos, capacidade global/local, buffers e expediente local     | Renderizar recursos não garante capacidade transacional. Compare regras, não somente screenshots.                                               |
| Form/conteúdo próprios | Editor independente, `evaluateEvent` e slots React                       | Outras bibliotecas também oferecem callbacks/renderização do consumidor; é flexibilidade útil, não invenção exclusiva.                          |

As views de recursos e o editor implementados da Calendara são MIT, sem um bloqueio pago separado. Não é a única alternativa MIT: [Mantine Schedule](https://mantine.dev/schedule/getting-started/) é MIT e documenta componentes de recursos; [React Big Calendar](https://github.com/bigcalendar/react-big-calendar/blob/master/LICENSE) também é MIT.

[FullCalendar Premium](https://fullcalendar.io/docs/premium) inclui views de recursos, timeline e impressão na licença premium. O [modal interativo](https://schedule-x.dev/docs/calendar/plugins/interactive-event-modal) e [Draw](https://schedule-x.dev/docs/calendar/plugins/draw) do Schedule-X exigem licença premium; compare plugins realmente necessários em vez de considerar todo o produto pago.

As vantagens da Calendara são contrato React nativo único, validação compartilhada entre gesto/form, seleção explícita de views e regras por recurso. As desvantagens são implementação mais jovem, menos integrações, atualização manual via assets GitHub, recorrência parcial, editor padrão atualmente limitado a português/inglês e validação física/acessibilidade incompleta. MIT não oferece SLA de suporte.

O [guia React do FullCalendar](https://fullcalendar.io/docs/react), [setup Mantine](https://mantine.dev/schedule/getting-started/) e [README RBC](https://github.com/bigcalendar/react-big-calendar/blob/master/README.md) mostram seus requisitos. Uma biblioteca madura pode reduzir o trabalho total, mesmo com instalação mais extensa.

Antes de adotar, prototipe as quatro tarefas com capacidade realista, recorrência, falhas assíncronas e tela estreita. Meça conclusão, recuperação e leitura com usuários. Os contratos auditados de fonte de verdade/view inicial tratam confusões conhecidas; não comprovam usabilidade superior sem essa avaliação.

## Cobertura de views e integração

Use `views={[dayView, monthView]}` para registrar somente as views necessárias e `initialView="month"` para escolher a primeira. `BUILTIN_VIEWS` é um atalho explícito para semana/dia/mês/lista. Editor, CSS e persistência são escolhas do aplicativo; conteúdo, toolbar e formulário próprios não exigem substituir o calendário inteiro. A desvantagem é precisar entender os contratos de datas e confirmação assíncrona. Os [exemplos focados](../../examples/features.html) demonstram essas integrações.

| View/capacidade | Situação na Calendara | Referência e recomendação |
| --- | --- | --- |
| Recursos verticais por dia | Implementada, MIT | Equivalente de categoria à [Vertical Resource Premium](https://fullcalendar.io/docs/premium), sem afirmar paridade. |
| Timeline horizontal de recursos por dia | Implementada, MIT | Categoria também premium no FullCalendar. [DayPilot React Scheduler](https://doc.daypilot.org/scheduler/react/) oferece Lite gratuito e Pro; timeline não é exclusivamente um recurso pago. |
| Recursos × vários dias | Ainda não implementada | Alta utilidade para comparar salas/equipes durante a semana. Primeira candidata, com navegação, headers, multi-dia e ocupação especificados antes da implementação. |
| Timeline semanal/mensal e recursos agrupados | Ainda não implementada | Útil para escalas/reservas; agrupamento e virtualização exigem contratos próprios. Segunda candidata, conforme volume real de recursos. |
| Ano/trimestre com vários meses | Ainda não implementada | [FullCalendar Multi-Month](https://fullcalendar.io/docs/multimonth-grid) está entre as views padrão; não divulgar ano como vantagem sobre recursos pagos. Útil para férias/feriados e planejamento, menor prioridade para recepção diária. |
| Agenda do dia e planejamento anual | Resumo do dia é um exemplo customizado; planejador anual ausente | [Bryntum documenta dayagenda, monthagenda e yearplanner](https://bryntum.com/products/calendar/docs-llm/api/Calendar/view/Calendar.md). Uma agenda diária própria pode melhorar triagem sem precisar de um novo motor. |
| Impressão/PDF | Ausente | Categoria premium no FullCalendar; é saída/exportação, não uma nova view interativa. Requer layout de impressão próprio. |

Os recursos ausentes são extensões possíveis, não contratos atuais da API. Cada um exige escopo, regras de interação e testes próprios.

A medição de [bundles e facilidade de integração](bundle-comparison.md) recomenda manter um pacote: views opcionais representam uma fração pequena do custo atual; mecanismos compartilhados e fallback Temporal predominam. Separar pacotes agora aumentaria o alinhamento de versões sem comprovar uma redução importante. Subpaths/lazy loading continuam candidatos quando houver medidas que os justifiquem.
