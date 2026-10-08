> Engineering archive / Arquivo de engenharia. Consulte os guias públicos EN/PT para o contrato atual.

# Análise de cenários e requisitos

Este documento descreve problemas genéricos de uma agenda React. O contrato atual está no [guia de API](../pt-BR/api.md); implementação e evidências ficam nas [specs da auditoria](../../specs/calendar-remediation/tasks.md).

## Cenários

- Uma aplicação recebe eventos remotos por período e precisa descartar respostas antigas ao navegar.
- Um usuário move ou redimensiona um evento; a alteração permanece somente quando a aplicação aceita e persiste o resultado.
- Um evento ocupa vários recursos, cada um com disponibilidade, capacidade e buffers próprios.
- Uma agenda reúne eventos simultâneos ou de vários dias sem ocultar o acesso ao conteúdo.
- Uma aplicação escolhe apenas as views necessárias e usa seu próprio formulário ou conteúdo React.
- Um usuário acessa a agenda em uma tela pequena, por teclado ou com zoom.

## Requisitos derivados

| Problema | Comportamento esperado |
|---|---|
| Busca atrasada sobrescreve a data atual | Cancelamento e proteção contra resposta obsoleta |
| Edição desaparece após interação | Contrato explícito de aceite, persistência e recusa |
| Mesma regra apresenta resultados diferentes entre views | Validação compartilhada de disponibilidade, recursos e fim exclusivo |
| Eventos próximos ficam inacessíveis | Layout e overflow configuráveis, mantendo acesso a cada evento |
| Formulário ou view exige alterações internas | Slots React, views explícitas e validação pública |
| Dependência de uma interface específica | Separação entre cálculo, interação e apresentação |

## Limites

Regras de negócio, autorização e reserva transacional pertencem à aplicação e ao backend. Comparações com concorrentes orientam decisões; não demonstram defeitos ou desempenho superior sem reprodução e medição.
