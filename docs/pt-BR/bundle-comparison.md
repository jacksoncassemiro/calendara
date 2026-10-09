# Comparação de tamanho e integração

Manter um pacote React. As medições da fonte atual mostram que eliminar a duplicação de recorrência/Temporal rende mais que separar pacotes de views.

## Contribuição JavaScript medida

Vite 8.3.3, ES2022, minificação de produção e tree shaking. React, React DOM e CSS são excluídos igualmente. Os totais incluem todos os chunks JavaScript, comprimidos separadamente; não representam transferência inicial, tamanho do arquivo de instalação, velocidade nem igualdade de recursos.

| Cenário | Bytes minificados | Bytes gzip |
| --- | ---: | ---: |
| Calendara Dia | 212.628 | 67.928 |
| Calendara Mês + Dia | 225.137 | 70.925 |
| FullCalendar Mês + Dia, React 7.1.1 | 256.315 | 70.580 |
| Schedule-X Mês + Dia, calendar 4.9.1 / React 4.1.0 | 235.920 | 68.704 |
| Mantine Mês + Dia, 9.7.1 | 276.794 | 85.076 |
| React Big Calendar Mês + Dia, 1.20.0 / Day.js 1.11.23 | 184.318 | 54.871 |

Antes da mudança de recorrência, Calendara Mês + Dia ocupava **146.041 bytes gzip**. Reutilizar o iterador civil com Temporal injetada e escolher o fallback menor remove **75.116 bytes (51,4%)**. A entrada cai de 83.195 para **34.516 bytes gzip**. O total ainda inclui o fallback Temporal lazy (19.022 bytes), popover (16.763 bytes) e rótulos compartilhados (624 bytes). Temporal nativo evita baixar o fallback; abrir eventos excedentes carrega o popover quando necessário. Dia exclui MonthView, ListView e o editor.

O motor anterior embutia uma segunda implementação de Temporal. Agora permanece apenas como referência diferencial de desenvolvimento; produção usa o iterador civil e um namespace injetado/nativo/fallback. Testes de integração cobrem regras, horários inexistentes no DST, COUNT, UNTIL, exceções, overrides e identidade original. A mudança reduz transferência, sem prometer expansão mais rápida em toda carga.

[Resultados atuais](../../experiments/bundle-audit/current-results.json), [resultados anteriores à mudança](../../experiments/bundle-audit/pre-civil-results.json) e [receita com versões fixadas](../../experiments/bundle-audit/README.md) preservam versões e evidência dos chunks. Os [resultados 0.1.0](../../experiments/bundle-audit/results.json) e [baseline da seleção de views](../../experiments/bundle-audit/baseline.json) são históricos. A medição usa a entrada pública da fonte; consumo do arquivo de release é verificado separadamente por `yarn test:package`.

## Escolhas de integração

O fallback escolhido e seus recursos/desempenho estão documentados na [comparação de Temporal](temporal-comparison.md).

| Biblioteca | Integração inicial | Consequência prática |
| --- | --- | --- |
| Calendara | JSX, eventos, views selecionadas obrigatórias; CSS/editor opcionais | Uma instalação e persistência explícita; contratos de datas e recursos precisam de explicação |
| FullCalendar | JSX e plugins de views/tema | Seleção precisa de recursos; escolhas de plugins/tema/licença acrescentam etapas |
| Schedule-X | Hook da aplicação, fábricas de views, wrapper e peers | Extensões amplas; mais runtimes e versões para alinhar |
| Mantine | Views, provider, estilos e dependências de datas | Conveniente no ecossistema Mantine; configuração adicional fora dele |
| React Big Calendar | JSX, localizer, CSS e altura do container | API familiar e escolha de biblioteca de datas; localização e geometria exigem configuração |

São contratos observáveis, não estudo de usabilidade: [FullCalendar React](https://fullcalendar.io/docs/react), [Schedule-X React](https://schedule-x.dev/docs/frameworks/react), [configuração Mantine](https://mantine.dev/schedule/getting-started/) e [React Big Calendar](https://github.com/bigcalendar/react-big-calendar#readme).

Recursos, timelines, recorrência, drag/resize e impressão implementados na Calendara são MIT. FullCalendar lista views de recursos, timelines e impressão sob [Premium](https://fullcalendar.io/docs/premium). Schedule-X distribui extensões por [plugins](https://schedule-x.dev/docs/calendar/plugins); conferir cada licença. Isso não estabelece paridade completa nem maturidade de produção. Virtualização automática continua como [proposta](../../specs/extended-views/virtualization.md), não recurso implementado.

## Floating UI e limites dos pacotes

O popover compartilhado de eventos excedentes é lazy também em Dia; sua presença não registra Mês implicitamente. Seus **16.763 bytes gzip** representam cerca de 23,6% do total atual Mês + Dia. Posicionamento, fechamento, retorno do foco e interação por teclado fazem parte do comportamento. Um probe menor somente de posicionamento não oferece interações equivalentes. Ver [separação entre posicionamento e interação no Floating UI](https://floating-ui.com/docs/react) e [medições isoladas](../../experiments/bundle-audit/floating-results.json).

[Popover nativo](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API) e [ancoragem CSS](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Anchor_positioning) são candidatos após validar foco, transbordamento, scroll aninhado e navegadores. Manter a implementação lazy atual até verificar uma alternativa equivalente.

A [issue #7029 do FullCalendar](https://github.com/fullcalendar/fullcalendar/issues/7029) relatou aumento de tamanho num beta v6 de 2022 e está fechada. Sustenta medir bundles de consumidores, sem concluir desempenho atual v7 nem frequência de reclamações. Não foi encontrada reclamação verificada nas fontes revisadas exigindo vários pacotes semelhantes à Calendara.

Manter pacote único e views/editor/CSS opcionais. Subpaths ou carregamento lazy da rota podem melhorar integração sem alinhamento de versões e múltiplas releases. Separar pacotes sozinho não elimina o custo compartilhado de Temporal.
