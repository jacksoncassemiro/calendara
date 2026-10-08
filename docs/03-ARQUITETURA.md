# Arquitetura

Calendara é uma biblioteca React em um único pacote. [API atual](pt-BR/api.md) · [Guia de uso](pt-BR/getting-started.md).

## Responsabilidades

| Diretório | Responsabilidade |
|---|---|
| `src/core/date` | Datas, horários e resolução de Temporal |
| `src/core/recurrence` | Parsing, expansão de datas, ocorrências e divisão de séries |
| `src/core/constraint` | Avaliação de disponibilidade e bloqueios |
| `src/core/geometry` | Posicionamento e sobreposição visual |
| `src/core/interaction` | Gestos, ocupação e mudanças propostas |
| `src/core/render` | Estado, projeções e composição de regras por recurso |
| `src/core/store` | Assinaturas e memoização por identidade |
| `src/react/app` | Coordenação do calendário e de fontes de eventos |
| `src/react/views` | Views, componentes compartilhados, modelos, layout e registro |
| `src/react/components` | Moldura e controles comuns |

Os componentes de view ficam separados dos utilitários em `components`, `layout`, `models`, `formatting`, `hooks` e `registry`. Compartilhar uma implementação visual não obriga a registrar todas as views.

## Contratos

- O consumidor mantém eventos e decide persistência. Alterações propostas podem ser recusadas.
- Eventos têm intervalos com fim exclusivo; recursos são identificadores genéricos.
- `initialView` e `initialDate` configuram a montagem. Pedidos posteriores e callbacks estão descritos no guia de API.
- Opções declarativas substituem os valores declarados; a API imperativa permite patches.
- O editor é opcional. Formulários próprios podem usar `evaluateEvent` antes de atualizar seus dados.
- Conteúdo de eventos pode retornar componentes React; hooks pertencem ao componente, não ao callback de renderização.

O iterador civil de recorrência usa campos gregorianos. A composição de eventos preserva fusos e DST, com fallback Temporal quando necessário. Consulte a [decisão de recorrência](../experiments/civil-recurrence/ADOPTION.md).

O CSS distribuído define o tema padrão. O CSS de `examples` pertence apenas ao playground. Autorização, validação do servidor e atomicidade de reservas continuam na aplicação consumidora.
