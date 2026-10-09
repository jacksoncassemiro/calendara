# Referência: critérios para comparar bibliotecas de calendário

Esta referência preserva os critérios de pesquisa do protótipo inicial. A [comparação pública](../pt-BR/comparison.md) contém capacidades e limites atuais; a [comparação de pacote](../pt-BR/bundle-comparison.md) registra as medições reproduzíveis.

## Questões de integração

- Como a aplicação escolhe as views e o estado inicial?
- Conteúdo, formulário e navegação próprios usam a árvore React do consumidor?
- Uma alteração proposta pode ser recusada sem perder a identidade da ocorrência?
- Fontes remotas são canceláveis e protegidas contra respostas antigas?
- Recursos, disponibilidade, buffers e capacidade têm contratos independentes?
- A interface responde à largura do contêiner e permite acesso aos eventos ocultos?

## Fontes de referência

- [FullCalendar: documentação](https://fullcalendar.io/docs) e [recursos premium](https://fullcalendar.io/docs/premium).
- [Schedule-X: integração React](https://schedule-x.dev/docs/frameworks/react).
- [React Big Calendar: repositório e exemplos](https://github.com/jquense/react-big-calendar).
- [Syncfusion: documentação React Schedule](https://ej2.syncfusion.com/react/documentation/schedule/getting-started).

## Limites da análise

Arquitetura semelhante não demonstra compatibilidade, menor bundle ou melhor desempenho. Relatos públicos servem para formular cenários de reprodução, sem atribuir à versão atual defeitos observados em versões anteriores.

A hipótese inicial de renderer Preact separado foi substituída por React nativo. O motivo e os cenários que permanecem úteis estão no [registro de arquitetura anterior](../history/status-before-calendara.md).
