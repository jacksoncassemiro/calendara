# Extended views / Views adicionais

## Scenario / Cenário

The comparison identified missing resource/date combinations, longer planning periods and printing. Implement these with Calendara's existing MIT engines and explicit view registration, without claiming competitor parity.

A comparação identificou ausência de combinações de recursos/datas, períodos maiores de planejamento e impressão. Implementar com os motores MIT existentes e registro explícito de views, sem alegar paridade com concorrentes.

## Contracts / Contratos

- `createResourceView(ResourceViewInput)`: 1–366 vertical days, reference-date or week alignment, grouping by date or resource. The single-day factory delegates to the same implementation.
- `createResourceView(ResourceViewInput)`: 1–366 dias verticais, alinhados pela data ou semana, agrupamento por data ou recurso. A fábrica de dia único delega à mesma implementação.
- `createResourceTimelineView(ResourceTimelineConfig)`: day/week/month tracks, consumer resource groups, collapsed groups, explicit resource window and configurable day width.
- `createResourceTimelineView(ResourceTimelineConfig)`: faixas diárias/semanais/mensais, grupos definidos pelo consumidor, recolhimento, recorte explícito de recursos e largura diária configurável.
- `createMultiMonthView(MultiMonthViewOptions)`: 1–24 month panels, with month/quarter/year alignment; `yearView` and `quarterView` supply presets.
- `createMultiMonthView(MultiMonthViewOptions)`: 1–24 painéis mensais, alinhamento por mês/trimestre/ano; `yearView` e `quarterView` fornecem configurações prontas.
- `createYearPlannerView(YearPlannerViewOptions)`: annual date overview with event indicators and consumer callbacks.
- `createYearPlannerView(YearPlannerViewOptions)`: visão anual por data com indicadores de eventos e callbacks do consumidor.
- `CalendarPrintOptions` and `CalendarPrintInput`: complete visible-range event snapshot, escaped text, theme-independent paper layout and native print dialog.
- `CalendarPrintOptions` e `CalendarPrintInput`: snapshot completo dos eventos do período visível, texto escapado, papel independente do tema e diálogo nativo de impressão.

## Invariants and limits / Invariantes e limites

Preserve exclusive ends, display timezone, full event duration and occurrence identity. Availability, capacity and buffers use the existing shared engines. Context resources override factory fallback resources; visible-resource filtering affects presentation.

Preservar fim exclusivo, fuso de exibição, duração completa e identidade da ocorrência. Disponibilidade, capacidade e buffers usam os motores compartilhados. Recursos do contexto substituem os padrões da fábrica; filtros de recursos afetam a apresentação.

Period timelines compose dated daily tracks; they are not a continuous compressed multi-day scheduling axis. `resourceWindow` is a consumer-selected slice, not automatic scroll virtualization. The annual planner has no drag/resize. PDF is provided by the browser print dialog, not a PDF generation engine. Physical mobile/Safari and native PDF saving require separate device validation.

Timelines de período compõem faixas diárias datadas; não formam um eixo contínuo comprimido de agendamento. `resourceWindow` é recorte escolhido pelo consumidor, não virtualização automática por scroll. O planejamento anual não tem arrasto/redimensionamento. PDF vem do diálogo de impressão do navegador, sem motor próprio de geração. Mobile/Safari físicos e gravação nativa do PDF exigem validação separada.
