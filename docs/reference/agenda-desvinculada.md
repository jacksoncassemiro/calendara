# Referência — agendas por recurso

## Cenário

Um evento reserva um ou mais recursos, como sala, equipamento ou espaço compartilhado. Cada recurso pode ter disponibilidade, capacidade e buffers diferentes. A agenda precisa apresentar e validar essas associações de maneira consistente.

## Contrato genérico

- `CalendarResource.id` identifica o recurso; `title` é seu rótulo.
- `CalendarEvent.resourceIds` associa um evento a zero ou mais recursos.
- `capacity` substitui o padrão global; `false` permite concorrência ilimitada.
- `businessHours` e `constraints` restringem a disponibilidade do recurso.
- `bufferBefore` e `bufferAfter` ampliam o intervalo ocupado para preparação.
- `type` e `metadata` transportam informações da aplicação sem interpretar regras de negócio.

As views de recursos apresentam colunas por recurso; a timeline apresenta linhas. Filtros de visibilidade não alteram os dados do evento. `parentId` pode representar associação hierárquica nos dados, mas não garante uma interface de árvore.

## Responsabilidade da aplicação

A aplicação decide quais recursos são obrigatórios, como escolher recursos equivalentes e como persistir a reserva de forma atômica. A biblioteca calcula a proposta, apresenta feedback e permite recusa; a validação do backend permanece necessária.

[API atual](../pt-BR/api.md) · [Cenários e requisitos](../history/01-ANALISE.md) · [Modelo e integrações](data-model-mapping.md).
