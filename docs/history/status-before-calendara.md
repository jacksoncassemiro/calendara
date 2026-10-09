# Decisões anteriores à biblioteca React nativa

Registro de engenharia da arquitetura inicial. O contrato vigente está nos [guias públicos](../pt-BR/README.md); este arquivo não descreve instalação ou configuração atual.

## Renderer

O protótipo inicial separava um core com renderer Preact de um binding React. Componentes personalizados exigiam uma ponte entre árvores de renderização, com cuidados adicionais para providers, portals, foco e desmontagem.

A implementação posterior adotou React nativo em um pacote único. O core permanece sem dependência do renderer, e views, slots e formulários pertencem à árvore React do consumidor. Essa decisão atende ao público React sem manter uma segunda árvore de UI.

## Recorrência

Os protótipos identificaram que ordinais de BYDAY precisam ser representados por entrada: `2FR,4FR` não equivale a aplicar um BYSETPOS global indiscriminadamente. Eventos all-day usam datas civis; eventos timed preservam horário local e fuso.

Os cenários e harnesses úteis permanecem em [validação de recorrência](../reference/recurrence-validation.md) e na [decisão do experimento civil](../../experiments/civil-recurrence/ADOPTION.md). Contagens antigas de testes não representam a cobertura atual.

## Recursos e validação

Recursos são genéricos. Um evento pode ocupar sala, profissional e equipamento simultaneamente; cada associação precisa validar disponibilidade, capacidade e buffers. Sobreposição visual não define capacidade de reserva.

Os [cenários por recurso](../reference/agenda-desvinculada.md) e a [auditoria por personas](08-auditoria-personas.md) preservam os casos relevantes. A aplicação mantém persistência e o backend garante concorrência transacional.
