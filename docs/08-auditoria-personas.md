# Auditoria por personas, recursos e limites

Revisão em 07/10/2026. Fontes oficiais consultadas nesta data; houve inspeção visual das demos do FullCalendar, sem executar uma suíte de testes nos concorrentes. Este documento não declara paridade nem validação integral.

**VALIDADO** significa cenário específico executado pelo agente principal no Edge. **HIPÓTESE** exige reprodução antes de classificar como bug. **LACUNA** indica funcionalidade ou evidência de suporte ausente, não necessariamente defeito.

## Evidência por persona

| Persona | Estado | Evidência e alcance |
|---|---|---|
| Recepcionista | VALIDADO pelo agente principal | `browser-persona-reception-review.js`: criação na sala escolhida; capacidade própria ilimitada prevalece sobre padrão global; memória após troca de views; edição recusada preserva evento; reagendamento válido; preparo com capacidade 1 e início exatamente no fim do buffer |
| Profissional de saúde | VALIDADO pelo agente principal | `browser-persona-clinician-review.js`: inserir/remover faixa de dia inteiro durante scroll; transferir fragmento visível de plantão 19h–09h preservando intervalo completo; continuidade no mês; título visível após rolagem horizontal |
| Agenda pessoal | VALIDADO pelo agente principal | `browser-persona-personal-review.js`: foco ao abrir/fechar popover e editor por teclado; edição isolada de ocorrência recorrente; preservar horários ao mudar slots/rótulos; seleção do mês compacto mantida ao voltar ao desktop |
| Administrador de salas | VALIDADO pelo agente principal | `browser-persona-admin-review.js`: oito reservas simultâneas e uma isolada; lado a lado/sobreposição/+mais; ocultos na timeline e arraste pelo popover; botão React personalizado dentro do popover. |

As personas exercitam tarefas, não usuários reais recrutados. Não inferir usabilidade clínica, conformidade de acessibilidade ou desempenho de toda a biblioteca a partir desses roteiros.

## Contratos atuais que precisam ficar claros

- Capacidade é configurável por recurso. `undefined` herda o padrão global; `false` permite concorrência ilimitada. Sobreposição visual (`slotEventOverlap`) e agrupamento (`timedEventOverflow`) não alteram capacidade nem horários.
- Buffers integram a ocupação: estendem intervalos antes/depois da reserva para calcular concorrência. Capacidade ilimitada também permite sobreposição nesses intervalos; buffer não é um bloqueio absoluto independente.
- `businessHours` pode ser próprio de cada recurso. Bloqueios pontuais e faixas permitidas pertencem ao conjunto global de constraints atual; o recurso não expõe um conjunto completo de exceções próprias.
- Gravação aceita na demonstração atualiza estado em memória. Rollback local evita desfazer alterações mais novas; isso não equivale a uma transação no servidor nem impede duas recepções de reservarem a mesma sala simultaneamente.
- O editor usa fuso explícito e rejeita horários locais inexistentes/ambíguos. Recorrências têm políticas próprias para gaps/folds, com testes unitários em `tests/core/recurrenceSet.spec.ts`. A interação visual em dias de DST não foi validada pelos roteiros de persona, que usam UTC ou São Paulo.

## Próximos cenários prioritários

| Prioridade | Estado | Cenário e critério verificável |
|---|---|---|
| Alta | HIPÓTESE | Buffer atravessando meia-noite: reserva termina 23h50, preparo de 20 minutos, candidato às 00h05 seguinte. A avaliação diária pode excluir a reserva anterior porque o evento não cruza o dia, mesmo quando seu buffer cruza. Reproduzir com capacidade 1, incluindo janela de navegação que começa no segundo dia |
| Alta | LACUNA de integração | Duas instâncias tentam a última vaga ao mesmo tempo. O aplicativo precisa persistir e validar capacidade atomicamente no backend, usando versão/conflito/idempotência e callback de recusa. Aceite: só uma gravação confirmada; a outra restaura seu evento e informa o conflito |
| Alta | LACUNA de evidência | iOS/Safari e Android com toque físico: rolar começando sobre cartão, tocar para editar, cancelar gesto, redimensionar alvo pequeno e mover entre colunas. Aceite: scroll não altera reserva; cancelamento nunca confirma mudança; edição funciona sem drag |
| Alta | HIPÓTESE de UX | Dia com DST e hora repetida em `America/New_York`: distinguir os dois instantes 01h30 e preservar duração ao mover/estender. Aceite: política de escolha explícita no editor; callback informa instante/fuso sem tratar dois instantes como mesma reserva |
| Média | LACUNA | Indisponibilidade pontual por sala/profissional, independente do expediente semanal. Aceite: fechar somente Sala 2 no dia escolhido; Sala 1 permanece disponível; visual, clique, editor e drag concordam |
| Média | LACUNA de evidência | Leitores de tela NVDA/VoiceOver, zoom 200%, contraste forçado e teclado no modo +mais. Aceite: nome do evento com data/horário/recurso; foco previsível após exclusão; informação de recusa anunciada; editar início/fim sem ponteiro |
| Média | LACUNA de escala | Centenas de recursos e milhares de ocorrências recorrentes. Medir expansão, projeção, geometria, React/DOM e movimento separadamente. Não usar apenas tamanho de bundle ou quantidade de testes como evidência de desempenho |

## Comparação que ajuda a priorizar

[FullCalendar eventMaxStack](https://fullcalendar.io/docs/eventMaxStack) documenta limite horizontal no time-grid, vertical na timeline e popover de ocultos. A biblioteca local já oferece essas políticas; o teste do administrador verifica sua combinação com sobreposição e arraste. O catálogo não demonstra que todo caso de empacotamento local esteja correto.

[FullCalendar touch](https://fullcalendar.io/docs/touch) descreve long press para selecionar, mover e redimensionar. Localmente há Pointer Events e cancelamento, mas não há política pública de atraso para toque. Esse é um candidato concreto antes de declarar drag mobile completo. A [documentação de fusos](https://fullcalendar.io/docs/timeZone) também reforça a distinção entre fuso exibido e instante; comparar essa semântica, não apenas rótulos.

[Schedule-X configuration](https://schedule-x.dev/docs/calendar/configuration) separa largura do evento, sobreposição, quantidade de dias e configuração de fuso. Isso sustenta manter nossos controles de slot, escala, rótulos e densidade independentes. Sua janela híbrida que termina no dia seguinte é uma referência para plantões; localmente a grade diária recorta um intervalo contínuo em segmentos por data.

[Mantine MobileMonthView](https://mantine.dev/schedule/mobile-month-view/) combina indicadores no mês com lista do dia e declara ausência de drag nesse componente. A alternativa local de lista/editor em celular é coerente com essa tarefa; ainda precisa validação física. [ResourcesSchedule](https://mantine.dev/schedule/resources-schedule/) oferece referência de composição de views de recursos, sem obrigar a biblioteca local a adotar Mantine.

[DayPilot concurrent event groups](https://doc.daypilot.org/scheduler/concurrent-event-groups/) documenta grupos expansíveis de eventos concorrentes. Hoje nosso +mais abre popover/componente/view; expandir o grupo dentro da própria linha seria uma funcionalidade adicional, não um sinônimo do popover já existente. Recursos hierárquicos recolhíveis, timeline com vários dias, virtualização, ICS, impressão e undo/redo continuam lacunas locais úteis conforme o domínio, sem necessidade de implementar todas antes de uma agenda básica utilizável.

## Preact: análise sem migração

A [documentação oficial de Preact](https://preactjs.com/guide/v10/differences-to-react/) descreve diferenças de eventos/DOM e uma camada `preact/compat` voltada à compatibilidade com React. Isso permite estudar consumidores Preact por compatibilidade; não comprova estabilidade desta biblioteca nem elimina testes de hooks, portals, foco, SSR e slots do aplicativo.

O pacote atual usa React como peer. Em um aplicativo React, substituir internamente o renderer por Preact adicionaria outra árvore e fronteiras de providers/portals a resolver; não remove o custo de recorrência, conversões de fuso ou geometria. Preservar React nativo é a decisão proporcional ao foco atual. Uma experiência separada com alias `react` → `preact/compat`, se futuramente necessária, deve medir bundle completo, carga de dados, interação e compatibilidade dos slots antes de propor alteração da arquitetura. Não foi criada uma versão Preact nesta auditoria.

## Critério para encerrar uma rodada

Registrar o resultado específico, dados/viewport/fuso, comando e artefato visual de cada cenário. Marcar hipóteses como corrigidas somente após reproduzir e verificar a correção. Atualizar este documento quando terminar o administrador e a rodada completa; os estados acima não substituem seus resultados.

## Correções e manutenção desta rodada

A preparação antes/depois da meia-noite foi reproduzida em testes e corrigida: a validação considera intervalos completos de dias vizinhos. Resources e Timeline desenham as bandas desses intervalos sem renderizar a reserva fora do período visível e sem inventar buffers nas continuações de um plantão. Fontes remotas precisam fornecer eventos vizinhos: expandir recorrências locais não recupera dados que o backend não entregou.

A margem clicável do modo lado a lado fica na borda externa; não ocupa uma faixa larga entre cada cartão. Sobreposição, +mais e capacidade continuam opções independentes. As prévias de movimento/resize mostram título e intervalo proposto; o estado salvo só muda ao confirmar o gesto.

O formulário da série ganhou intervalo, dias semanais, dia mensal, mês/dia anual e fim por quantidade/data. Há testes de preservação de regras avançadas e validação, além de criação semanal no navegador. A UI não representa todo o RFC: cláusulas que não têm controles são conservadas. A demonstração valida o intervalo editado; conferir conflitos de todas as ocorrências futuras de uma série exige uma janela e uma política definidas pelo aplicativo.

Arquivos auxiliares separados em views/layout, views/models e views/hooks; exports públicos conservados. resourceViews ainda reúne duas views e é candidato a uma divisão posterior. Removido cálculo duplicado de densidade e de limites de resize. Não houve migração para Preact.

Validação de código desta rodada: yarn verify, 310 testes em 26 arquivos, tipos, builds e consumo externo do pacote. A checagem final de navegador está em andamento; resultados finais serão registrados após o encerramento.
