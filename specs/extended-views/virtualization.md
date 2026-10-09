# Virtualization architecture assessment

Status: proposal, not implemented automatic virtualization. Reviewed October 8, 2026.

## Scope and rationale

Current `resourceWindow` manually slices filtered/ordered rows. It limits DOM, but does not follow scrolling, preserve full virtual height or virtualize time columns. Many resource/day combinations still repeat daily projection. Removing hidden DOM without reducing projection work does not solve recurrence/geometry CPU cost.

[FullCalendar v7](https://fullcalendar.io/docs/virtual-rendering) currently virtualizes resource timeline rows and time columns; other view families are documented as planned. It also documents that offscreen content is absent from find-in-page/DOM queries, while printing renders the full data. Calendara should describe the same limitations honestly and should not label manual paging as equivalent.

## Proposed stages

1. Instrument representative workloads: 100/1,000 resources, 1/7/31 dates, 1,000/10,000 events, overlapping/buffered reservations, recurring overnight events, custom renderers. Measure recurrence/projection/layout separately from React commit, DOM node count, initial render, scrolling frames, heap and gesture latency. Use consumer container dimensions, not browser-window width assumptions.
2. Cache date/resource projections by data revision, display zone, date and constraint revision. Maintain full event/occupancy indexes for validation. Recurrence expansion remains tied to the visible date query; virtualization must not make absent rows appear available.
3. Virtualize timeline **resource rows first**, with an explicit bounded scrollport, overscan and measured row heights. Flatten group headings/resource rows into stable keyed rows. Store prefix offsets; use ResizeObserver to update variable heights and compensate scroll anchoring. Keep full spacer height and synchronized sticky resource labels/date headers.
4. Add horizontal date windows with a full-width spacer, date/slot coordinates derived from the model, and cross-date segments cropped from complete occurrences. Do not run month-long hourly DOM generation outside the visible columns. Keep today indicators correct when the current day is offscreen.
5. Consider agenda-day sections and year month panels only after the timeline contracts pass. Month grids with 35–42 cells need bounded event overflow before generic cell virtualization. Do not add complexity to small calendars without measured gains.

## Interaction and accessibility contracts

- The gesture engine currently locates rendered slot rectangles. An offscreen destination needs model-coordinate mapping based on scroll offset, date widths and row prefix offsets. Autoscroll should update this model without requiring a DOM slot to exist.
- Pin the active event/row and focused keyboard target during a drag or editor/overflow interaction. A node must not disappear while holding pointer capture. Unmount cancellation and async rollback must preserve original occurrence identity and full duration.
- Touch-hold versus native panning remains unchanged. Test fast flicks, autoscroll across both axes, collapsed groups, changing capacity/buffers, resize handles and rejected persistence.
- Maintain a logical keyboard sequence across unrendered rows, scroll focused items into view before focus, expose row indices/counts where using grid semantics, and preserve focus return after popovers close. A hidden row is not a disabled row.
- Printing must bypass virtualization and honor an explicit print row cap; browser find-in-page only sees mounted content. Document these differences.
- Sticky cloned headers and top horizontal scrollbar must use total logical dimensions; a changing rendered slice must not change scroll range or header offset.

## Feasibility and decision

Feasible, but medium-to-high complexity: variable heights, grouped collapse, two-axis gestures, arbitrary render content and asynchronous rollback make this an engine/rendering integration, not a CSS toggle. No reliable calendar-only timeline can be estimated from a row-list demo. Prefer a phased implementation and benchmark gate, not package splitting or introducing a virtualization dependency blindly.

Acceptance before enabling automatic virtualization: rendered nodes grow with viewport/overscan rather than total resource count; full occupancy validation stays invariant; DST/multi-day identity survives; pointer and keyboard work across window boundaries; no sticky drift; no focus loss; print includes intended rows; measured scrolling/commit improvement on the target workloads. Physical mobile and screen-reader checks remain separate from desktop Chromium evidence.

## Português

`resourceWindow` atual é um recorte manual, não virtualização automática. A proposta prioriza índices/cache de projeção e depois linhas de recursos da timeline, com altura lógica completa, overscan e medição das alturas variáveis. Janelas horizontais de datas vêm depois; a grade de mês precisa primeiro limitar eventos excedentes.

A validação continua usando toda a ocupação, inclusive linhas fora do DOM. Gestos precisam localizar destinos pelo modelo/scroll, manter evento/foco ativos montados e preservar identidade/duração/rollback. Cabeçalhos fixos, scrollbar superior, grupos, teclado e impressão precisam compartilhar dimensões lógicas. A impressão ignora a virtualização; busca do navegador encontra apenas conteúdo montado.

É viável com complexidade média-alta. O próximo passo deve ser medir cargas reais e implementar em etapas com critérios verificáveis, sem apresentar o recorte manual como equivalente ao recurso dos concorrentes e sem prometer ganho apenas pela redução de DOM.
