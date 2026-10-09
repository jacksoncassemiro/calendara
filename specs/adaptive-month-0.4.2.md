# Adaptive month density / Densidade adaptativa do mês

## Contract / Contrato

Measure each MonthGrid with ResizeObserver, independently of the window or surrounding annual/quarter controller. Reserve 48 px for date/overflow chrome and fit 22 px card lanes into a height budget derived from the day width. Keep monthMaxEvents as the upper bound; false retains unlimited cards. Preserve original occurrences, multi-day membership and all overflow actions.

Mede cada MonthGrid com ResizeObserver, independentemente da janela ou controlador de ano/trimestre. Reserva 48 px para data/overflow e ajusta linhas de cartões de 22 px em uma altura derivada da largura do dia. monthMaxEvents continua como teto; false preserva cartões ilimitados. Mantém ocorrências originais, datas dos eventos de vários dias e ações de overflow.

Use the foreground/button-background theme tokens for the +more control, with a 24 px target and zero vertical padding. Do not change the date style or activate compact mode automatically.

Usa tokens de texto/fundo de botão no controle +mais, com alvo de 24 px e sem padding vertical. Não altera o estilo da data nem ativa automaticamente o modo compacto.

## Evidence / Evidência

`scripts/browser-adaptive-month-review.js` resizes only the container at a constant desktop viewport. Its fixture includes seven timed events and a three-day all-day event: 1200/770/630/360 px panels show 3/2/1/0 cards on the busy date. Check exact hidden counts, complete popover data, navigation to the day view, unlimited rendering, six aligned weeks and bounded year/quarter heights. Inspect `output/layout-review/adaptive-*.png`; measure actual computed control colors rather than inferring contrast from screenshots.

O cenário redimensiona apenas o container com viewport desktop constante. Inclui sete eventos com horário e um evento de dia inteiro de três dias: painéis de 1200/770/630/360 px mostram 3/2/1/0 cartões na data cheia. Verifica contagens, popover completo, navegação para dia, exibição ilimitada, seis semanas alinhadas e alturas limitadas em ano/trimestre. Capturas: `output/layout-review/adaptive-*.png`; contraste é medido pelas cores computadas. Não equivale a teste em celular físico/Safari.

The competitor provides a height-limited overflow option; this implementation uses Calendara's own panel-width budget and existing callbacks: [FullCalendar dayMaxEvents](https://fullcalendar.io/docs/dayMaxEvents).

O concorrente oferece overflow limitado pela altura; esta implementação usa orçamento próprio baseado na largura do painel e callbacks existentes.
