# Touch, sticky axes and narrow month

## Scope

- Touch scrolling must not render or commit provisional selections/moves. Hold before touch dragging; mouse gestures remain immediate.
- The all-day label stays aligned with the time axis during combined page/horizontal scrolling.
- Month dates use compact typography to identify today. Selection remains distinct in indicator mode. Overflow counts stay on one line inside their day.
- A synchronized horizontal scrollbar is available near the header when content overflows; page scrolling remains vertical.
- Public comparison explains implemented resource views, missing view candidates and API/bundle tradeoffs without claiming feature parity.

## Evidence

Reproduce with Chromium touch input through Playwright CLI/CDP, capture transient drafts, then test cancellation and intentional long-press dragging. Inspect narrow month and fixed header screenshots. Physical phone/Safari confirmation remains separate.

## Validation, 2026-10-08

The complete browser suite passed. Touch input swiped without drafts/commits and committed intentional held moves. Combined page/horizontal scrolling preserved axis alignment. Narrow month screenshots showed uniform week heights, compact today emphasis and overflow actions inside their cells. API-driven day decoration met the tested 4.5:1 foreground/background contrast in both themes.

The `autoScroll: false` regression exposed a queued top-scrollbar synchronization event restoring an obsolete position. Synchronization now ignores its own queued events; the auto-scroll and sticky-header scenarios passed again, followed by the complete suite.

## Validação, 2026-10-08

A suíte completa de navegador passou. Gestos de rolagem por toque não criaram prévias nem gravaram alterações; movimentos após pressionar e segurar foram confirmados. Rolagem combinada preservou o alinhamento dos eixos. Capturas do mês estreito mostraram semanas uniformes, indicação compacta de hoje e ações de transbordamento dentro das células. A decoração de dias por dados de API atingiu contraste mínimo testado de 4,5:1 nos dois temas.

A regressão de `autoScroll: false` identificou um evento enfileirado da barra superior restaurando uma posição antiga. A sincronização passou a ignorar os próprios eventos; os cenários de rolagem e cabeçalhos fixos passaram novamente, seguidos da suíte completa. A validação não substitui testes em celular físico ou Safari.
