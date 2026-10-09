# Resource timeline virtualization

Status: automatic vertical resource-row rendering and nested resource hierarchy implemented. Reviewed October 9, 2026. Horizontal virtualization and projection caching remain proposed work.

## Current contract

`createResourceTimelineView({ virtualization: { height, overscan } })` opts into a bounded vertical scrollport. Height is in pixels and must be at least 120. Overscan is a nonnegative integer and defaults to four extra rows per edge. The row model includes consumer group headings and resource rows, with logical offsets and spacer height derived from their heights. Scrolling changes the mounted slice without shortening the logical scroll range.

`resourceWindow: { start, count }` remains an independent manual slice after resource filtering/order. It selects the logical input before automatic virtualization. It is not an alias for virtualization and does not promise access to resources excluded from the slice.

`hierarchy: true` flattens resource `parentId` relationships into nested rows. `collapsedResourceIds` selects initially collapsed parents. Missing parents become roots; cycles reject. Consumer grouping remains separate, and hierarchy is resolved inside each group. Hierarchy does not inherit or aggregate capacity, buffers or occupancy: every assigned resource is still validated independently. Collapsing descendants only changes presentation.

Resource title buttons support ArrowUp/ArrowDown across the logical row sequence. Mounted rows include the viewport/overscan window and focused/pointer/draft rows retained by the view. Offscreen resource data remains available to validation even when its row has no DOM node.

## Browser integration evidence

The centralized browser review uses [`scripts/browser-resource-window-review.js`](../../scripts/browser-resource-window-review.js). Its fixture contains 500 resources, a daily timeline, a 320 px scrollport and overscan 2. Each resource has capacity one and a 30-minute trailing buffer. An event occupies the last resource from 09:00 to 10:00, while a candidate proposes 10:15–10:45 on that resource.

Observed in desktop Chromium:

- At most 20 resource rows were mounted before/after scrolling and keyboard navigation.
- The initial logical scroll height was 22,103 px rather than only the mounted row height.
- The candidate on the offscreen last resource remained invalid because its interval intersects the event's trailing buffer.
- Scrolling to the bottom mounted Room 499 and its appointment; ArrowUp from the Room 499 title focused Room 498.
- A separate three-level Clinic → Room → Device tree started with its parent collapsed; expanding Clinic mounted three rows, and collapsing Room retained two.

The review captures `output/layout-review/virtual-resources.png`. These checks demonstrate bounded DOM, stable logical height, offscreen occupancy enforcement and the exercised keyboard/tree paths. They do not measure render/commit duration, CPU, heap, frames, physical mobile/Safari or screen-reader behavior. No relative speed or memory claim follows from the row count.

## Limits and next measurements

Date/time columns remain fully rendered inside mounted rows. The option does not provide a horizontal date window or cache resource/day projections. Calculating row heights still projects selected resource/day data; reducing DOM does not establish lower recurrence or geometry CPU cost. Browser find-in-page and direct DOM queries only inspect mounted content. Printing derives its own events for the requested range rather than exporting the mounted row slice.

[FullCalendar v7](https://fullcalendar.io/docs/virtual-rendering) documents vertical resource and horizontal time virtualization for resource timelines, plus full printed data and the limitations of searching offscreen DOM. Calendara's implemented scope is the vertical axis. This reference describes a different product contract, not a Calendara benchmark or parity result.

Remaining architecture work requires measured workloads before a performance claim:

1. Separate recurrence/projection/layout time from React commit, mounted nodes, heap and scrolling/gesture latency for realistic resources, dates and events.
2. Evaluate projection caches keyed by data revision, display zone, date and constraints while retaining complete occupancy indexes.
3. Define horizontal windows using full logical width and model coordinates, including offscreen destinations, today indicators and complete multi-day occurrence identity.
4. Broaden pointer, keyboard, focus return, custom content, async rollback and print checks across changing windows and collapsed groups.

Keep browser/build execution centralized. Physical mobile and screen-reader checks require separate evidence.

## Português

Status: renderização vertical automática de recursos e hierarquia aninhada implementadas. Virtualização horizontal e cache de projeções continuam como trabalho proposto.

`virtualization: { height, overscan }` habilita área de scroll limitada, com altura mínima de 120 px e padrão de quatro linhas extras por borda. Espaçadores preservam a altura lógica completa. `resourceWindow` continua como recorte manual anterior à virtualização; restringe a entrada lógica. `hierarchy: true` usa `parentId`, com pais inicialmente recolhidos em `collapsedResourceIds`; agrupamento é separado e a hierarquia é resolvida dentro de cada grupo. Filhos não herdam regras de capacidade/buffer/ocupação. Pais ausentes viram raízes; ciclos lançam erro.

O cenário Chromium desktop com 500 recursos, altura de 320 px e overscan 2 montou no máximo 20 linhas e manteve altura lógica de 22.103 px. A reserva proposta no último recurso fora da tela continuou inválida por intersectar o buffer de 30 minutos. O scroll revelou Room 499 e seu evento; ArrowUp em seu título focou Room 498. A árvore Clinic → Room → Device confirmou expansão e recolhimento aninhados. A captura está em `output/layout-review/virtual-resources.png`.

Esses resultados demonstram DOM limitado e os caminhos de validação, teclado e árvore exercitados. Não medem CPU, memória, quadros, tempo de commit nem dispositivos físicos/leitores de tela. Colunas de data/horário não são virtualizadas; projeções usadas para alturas continuam calculadas. Busca/consultas DOM encontram somente linhas montadas. Impressão deriva eventos do período solicitado, independentemente do recorte montado.

As próximas etapas são medir cargas reais, avaliar caches por revisão/fuso/data/restrições e definir janelas horizontais com coordenadas lógicas. Ampliar validação de ponteiro, foco, rollback e impressão exige evidências próprias. A documentação do [FullCalendar v7](https://fullcalendar.io/docs/virtual-rendering) descreve ambos os eixos no produto deles; não constitui medição nem paridade da Calendara.
