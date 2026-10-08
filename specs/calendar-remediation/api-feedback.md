# Críticas de API e aplicação nesta biblioteca

Relatos primários pesquisados em 08/10/2026. São casos individuais, não uma medida da frequência dos problemas. Relatos antigos não demonstram defeitos nas versões atuais dos concorrentes.

| Referência | Questão levantada | Resultado local |
| --- | --- | --- |
| [FullCalendar React #65](https://github.com/fullcalendar/fullcalendar-react/issues/65), 2020 | Quem mantém os eventos: React ou calendário? Integrações improvisadas podem gerar renderização duplicada | Documentado o uso de `events` com estado React ou `eventSource` com persistência/refetch. A resposta remota substitui a lista; não há merge implícito |
| [FullCalendar #7077](https://github.com/fullcalendar/fullcalendar/issues/7077), 2019 | Confusão entre data inicial e navegação por prop | `initialDate`/`initialView` são exclusivos da montagem. `date`/`view` solicitam navegação quando mudam; não são controlled estritos |
| [React Big Calendar #2807](https://github.com/bigcalendar/react-big-calendar/issues/2807), 2026 | Data inicial e fuso do navegador | Confirmado um defeito local distinto: fallback inicial usava o fuso do host. Agora resolve hoje no fuso configurado antes de callbacks e busca; testes em Kiritimati/Honolulu |
| [Schedule-X #1282](https://github.com/schedule-x/schedule-x/issues/1282), 2026 | Atualização dinâmica de snapping não aplicada até reload | Não reproduzido como defeito local. O motor lê `slotMinutes` atual; os roteiros de slots e gestos verificam alteração de configuração |
| [React Big Calendar #2588](https://github.com/bigcalendar/react-big-calendar/issues/2588), 2024 | Wrappers de drag desmontados durante atualização | Nenhum remount equivalente comprovado. Identificado e corrigido refetch desnecessário ao trocar view inativa/ordem; alteração do range ativo continua buscando |
| [Schedule-X #1287](https://github.com/schedule-x/schedule-x/issues/1287), 2026 | Nomes/tipos inconsistentes de props de componentes personalizados | Sem incompatibilidade equivalente confirmada. Contratos de slots documentados; mais contexto de view/recurso permanece candidato de API |
| [FullCalendar #7819](https://github.com/fullcalendar/fullcalendar/issues/7819), 2024 | Uso de hooks em callback de conteúdo | Guia orienta retornar um componente React e usar hooks dentro dele; não diretamente em `renderEvent` |

Não foi encontrado um conjunto verificável de críticas específico do Mantine Schedule nesta pesquisa. Não atribuir a ele problemas relatados em outras bibliotecas.

Outras correções confirmadas: a lista do mês compacto agora seleciona a data de referência, inclusive após navegação no mesmo mês; nomes vazios de views são recusados. As regressões ficam nos testes de lifecycle, invalidação de fonte e tema no navegador.

Evoluções separadas: CRUD/headless hook do editor, slots adicionais, múltiplas fontes/cache, auto-scroll, virtualização medida e teste físico de toque/leitores de tela. Não estão declaradas implementadas nesta fatia.
