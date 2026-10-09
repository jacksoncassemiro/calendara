# Comparação de tamanho e integração

Manter um pacote React. A medição de 9 de outubro de 2026 abaixo usa a fonte 0.3.0 após as adições de recursos. Eliminar a duplicação de recorrência/Temporal continua rendendo mais que separar pacotes de views. A medição anterior às novas funcionalidades permanece preservada separadamente.

## Contribuição JavaScript medida

Node 24.18.1 / Windows, Vite 8.3.3, ES2022, minificação de produção e tree shaking. React, React DOM e CSS são excluídos igualmente. Os totais incluem todos os chunks JavaScript, comprimidos separadamente; não representam transferência inicial, tamanho do arquivo de instalação, resultado SSR, velocidade nem igualdade de recursos. Opções de build e imports selecionados influenciam o resultado.

| Cenário                                               | Bytes minificados | Bytes gzip |
| ----------------------------------------------------- | ----------------: | ---------: |
| Calendara Dia                                         |           220.072 |     69.869 |
| Calendara Mês + Dia                                   |           232.597 |     72.856 |
| Calendara views embutidas + recursos + editor         |           270.568 |     81.995 |
| FullCalendar Mês + Dia, React 7.1.1                   |           256.315 |     70.580 |
| Schedule-X Mês + Dia, calendar 4.9.1 / React 4.1.0    |           235.920 |     68.704 |
| Mantine Mês + Dia, 9.7.1                              |           276.794 |     85.076 |
| React Big Calendar Mês + Dia, 1.20.0 / Day.js 1.11.23 |           184.318 |     54.871 |

Antes da mudança de recorrência, Calendara Mês + Dia ocupava **146.041 bytes gzip**. Os **72.856 bytes** atuais mantêm redução de **73.185 bytes (50,1%)** após os novos recursos. A entrada cai de 83.195 para **36.447 bytes gzip**. O total inclui o fallback Temporal lazy (19.022 bytes), popover (16.763 bytes) e rótulos compartilhados (624 bytes). A entrada de Dia ocupa 33.465 bytes gzip com popover de 16.758 bytes; a de views embutidas/recursos/editor ocupa 45.580 bytes, com popover de 16.769 bytes mais o mesmo fallback e rótulos. Temporal nativo evita baixar o fallback; abrir eventos excedentes carrega o popover quando necessário. Dia exclui MonthView, ListView e o editor. APIs ICS/histórico não importadas não contribuem nesses cenários.

O motor anterior embutia uma segunda implementação de Temporal. Agora permanece apenas como referência diferencial de desenvolvimento; produção usa o iterador civil e um namespace injetado/nativo/fallback. Testes de integração cobrem regras, horários inexistentes no DST, COUNT, UNTIL, exceções, overrides e identidade original. A mudança reduz transferência, sem prometer expansão mais rápida em toda carga.

[Resultados 0.3.0](../../experiments/bundle-audit/release-0.3-results.json) e [receita com versões fixadas](../../experiments/bundle-audit/README.md) preservam versões e evidência dos chunks. A [medição anterior aos novos recursos](../../experiments/bundle-audit/current-results.json), os [resultados anteriores à mudança de recorrência](../../experiments/bundle-audit/pre-civil-results.json), os [resultados 0.1.0](../../experiments/bundle-audit/results.json) e o [baseline da seleção de views](../../experiments/bundle-audit/baseline.json) são históricos. A medição usa a entrada pública da fonte; consumo do arquivo de release é verificado separadamente por `yarn test:package`.

## Escolhas de integração

O fallback escolhido e seus recursos/desempenho estão documentados na [comparação de Temporal](temporal-comparison.md).

| Biblioteca         | Integração inicial                                                  | Consequência prática                                                                          |
| ------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Calendara          | JSX, eventos, views selecionadas obrigatórias; CSS/editor opcionais | Uma instalação e persistência explícita; contratos de datas e recursos precisam de explicação |
| FullCalendar       | JSX e plugins de views/tema                                         | Seleção precisa de recursos; escolhas de plugins/tema/licença acrescentam etapas              |
| Schedule-X         | Hook da aplicação, fábricas de views, wrapper e peers               | Extensões amplas; mais runtimes e versões para alinhar                                        |
| Mantine            | Views, provider, estilos e dependências de datas                    | Conveniente no ecossistema Mantine; configuração adicional fora dele                          |
| React Big Calendar | JSX, localizer, CSS e altura do container                           | API familiar e escolha de biblioteca de datas; localização e geometria exigem configuração    |

São contratos observáveis, não estudo de usabilidade: [FullCalendar React](https://fullcalendar.io/docs/react), [Schedule-X React](https://schedule-x.dev/docs/frameworks/react), [configuração Mantine](https://mantine.dev/schedule/getting-started/) e [React Big Calendar](https://github.com/bigcalendar/react-big-calendar#readme).

Recursos, timelines, recorrência, drag/resize, impressão, [ICS](ics.md), [histórico](history.md) e [direção RTL](rtl.md) implementados na Calendara são MIT. FullCalendar lista views de recursos, timelines e impressão sob [Premium](https://fullcalendar.io/docs/premium). Schedule-X distribui extensões por [plugins](https://schedule-x.dev/docs/calendar/plugins); conferir cada licença. Isso não estabelece paridade completa nem maturidade de produção. [Views ampliadas](extended-views.md) implementa hierarquia e virtualização vertical automática; virtualização horizontal e cache de projeções continuam fora do contrato.

## Floating UI e limites dos pacotes

O popover compartilhado de eventos excedentes é lazy também em Dia; sua presença não registra Mês implicitamente. Seus **16.763 bytes gzip** representam cerca de 23,0% do total atual Mês + Dia. Posicionamento, fechamento, retorno do foco e interação por teclado fazem parte do comportamento. Um probe menor somente de posicionamento não oferece interações equivalentes. Ver [separação entre posicionamento e interação no Floating UI](https://floating-ui.com/docs/react) e as [medições isoladas históricas](../../experiments/bundle-audit/floating-results.json).

[Popover nativo](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API) e [ancoragem CSS](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Anchor_positioning) são candidatos após validar foco, transbordamento, scroll aninhado e navegadores. Manter a implementação lazy atual até verificar uma alternativa equivalente.

A [issue #7029 do FullCalendar](https://github.com/fullcalendar/fullcalendar/issues/7029) relatou aumento de tamanho num beta v6 de 2022 e está fechada. Sustenta medir bundles de consumidores, sem concluir desempenho atual v7 nem frequência de reclamações. Não foi encontrada reclamação verificada nas fontes revisadas exigindo vários pacotes semelhantes à Calendara.

Manter pacote único e views/editor/CSS opcionais. Subpaths ou carregamento lazy da rota podem melhorar integração sem alinhamento de versões e múltiplas releases. Separar pacotes sozinho não elimina o custo compartilhado de Temporal.
