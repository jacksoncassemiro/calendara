# Calendário React: conclusão da auditoria

## Objetivo e limites

Corrigir os defeitos identificados, tornar os contratos públicos previsíveis e validar a interação real. Este trabalho usa especificação → plano → tarefas → evidência, inspirado no [Spec Kit](https://github.com/github/spec-kit). Não requer instalar outro gerador ou mudar para Preact. Yarn e um único pacote permanecem.

Fonte de requisitos: [auditoria de API e views](../../docs/09-AUDITORIA-API-E-VIEWS.md), relatos do usuário e testes existentes. Recursos de concorrentes são referências, não evidência de funcionamento deste projeto.

## Requisitos e critérios de aceite

| ID | Requisito | Aceite |
| --- | --- | --- |
| API-01 | Selecionar exatamente as views e a inicial | `[monthView, dayView]` registra somente ambas; `view="day"` inicia em dia; omissão inicia na primeira; listas inválidas não alteram estado |
| API-02 | Observar navegação e carregamento | React recebe data/view/range inicial e mudanças; callback atualizado não recria calendário |
| DATA-01 | Cancelar fontes obsoletas | Fonte recebe AbortSignal; navegação, substituição e desmontagem abortam; resposta/erro antigo não sobrescreve atual; loading corresponde à busca atual |
| API-03 | Remover opções declarativas | Remover propriedade de `options` restaura default; API imperativa mantém semântica de patch |
| RES-01 | Regras específicas por recurso | Bloqueios locais somam aos globais; disponibilidade local intersecta a global; todos recursos envolvidos são validados, inclusive nas views comuns |
| CODE-01 | Clareza e reutilização | Nomes descrevem intenção; condições recorrentes do editor compartilhadas; IDs e dados dos testes preservados |
| DRAG-01 | Arrastar evento externo para calendário | Opt-in, evento canônico sem recorrência, duração preservada, preview com título/horário; valida restrições/capacidade; consumidor recebe mudança para persistir |
| DRAG-02 | Arrastar evento para fora | Opt-in, informa ocorrência e destino; não remove evento automaticamente; Escape/cancel/desmontagem não persistem; soltura externa não altera horário internamente |
| QA-01 | Regressão integrada | Typecheck, testes, build, consumidor do pacote e demo passam; navegador verifica views, layout, editor, recursos e arrasto |

## Contratos de arrasto externo

Entrada usa evento canônico tipado de aplicação, sem ler JSON arbitrário de HTML/DataTransfer. O consumidor fornece callback e decide inserir/persistir. Eventos recorrentes externos exigem escolha explícita de ocorrência: nesta primeira fatia, importar uma série inteira por gesto é rejeitado. Saída informa a ocorrência existente e o elemento sob o ponteiro, sem exclusão automática de série/evento. A aplicação pode usar uma área de destino e atualizar suas props após persistência.

## Pendências de produto separadas dos defeitos

As seguintes expansões continuam candidatas com especificação própria, não são declaradas corrigidas nesta entrega: timeline de vários dias/ano, hierarquia e virtualização de recursos, múltiplas fontes com cache, opções por view, internacionalização completa, exportação ICS/impressão/undo, RTL e backend com concorrência atômica. Auto-scroll e interação touch com pressão longa precisam de fatia e validação específicas. Safari/iPhone físico e leitor de tela requerem equipamentos/execução além da validação desktop. O fechamento desta especificação não afirma paridade completa com concorrentes.
