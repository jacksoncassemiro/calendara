# Auditoria de layout e interação — 07/10/2026

## Problemas reproduzidos e corrigidos

- Eventos densos: 32 simultâneos causavam 31 interseções de retângulos em Dia e Recursos a 375 px; seis eventos consecutivos de cinco minutos causavam cinco na timeline. Padding/bordas impunham largura mínima e a timeline não reservava a duração visual mínima. Depois da correção, nenhuma interseção em 12 cenários (três views, quatro larguras).
- Eixo da timeline: altura zero sobrepunha rótulos à primeira linha. Agora há faixa própria e espaçamento adaptativo dos rótulos.
- Mês: botão “mais” herdava altura mínima do exemplo e invadia a semana seguinte. Altura reservada e barra contínua corrigidas; eventos atravessam dias e semanas, com fim exclusivo.
- Movimento no mês: hit-test por data agora preserva relógio, duração integral e ocorrência recorrente. Redimensionar mantém o início e atualiza o fim.
- Eventos de dia inteiro atribuídos a recursos agora aparecem nas grades de recursos e podem ser transferidos.
- Popover: lista padrão posicionada com Floating UI carregado sob demanda; conteúdo React customizável, componente externo via callback ou navegação para outra view.
- Escala: pxPerMinute e timeLabelInterval são independentes de slotMinutes. Exemplo oferece controles de espaçamento/rótulos.
- Rolagem: semana/N dias e recursos preservam largura mínima, alinhamento e acesso ao último dia/recurso; adaptação também considera painel estreito em desktop.

## Edição que parece desaparecer

O exemplo anterior ativava expediente e bloqueio de almoço inicialmente. Movimentos/redimensionamentos que atravessavam esses intervalos eram recusados. As restrições de horário agora são opcionais e desativadas inicialmente, com mensagem explícita de recusa. Capacidade e buffers continuam sendo respeitados.

No navegador, movimentos aceitos sobreviveram à troca de opções, troca de view e abertura do editor; editar o título preservou o intervalo movido/redimensionado. Rejeições restauraram o intervalo anterior. O exemplo mantém dados em memória; gravar no servidor pertence ao consumidor, pelos callbacks de edição.

## Validação

`yarn verify`: 296 testes em 24 arquivos, tipos, builds, tarball ESM/CJS/CSS e consumidor React TypeScript externo. `yarn test:browser`: fluxos reais no Edge, incluindo edição controlada, drag/resize, recusas, recursos, recorrência, mês/popover/customização, densidade e rolagem; screenshots em output/layout-review. Foram inspecionadas imagens de mês, semana, recursos e timeline em desktop e telas estreitas.

`yarn audit:dependencies`: zero alertas reportados em 07/10/2026. Isso não demonstra ausência de vulnerabilidades desconhecidas.

## Limites restantes

Não há paridade completa com concorrentes: agrupamento do excesso na timeline horizontal, virtualização, auto-scroll durante drag, drag/resize por teclado, ICS, undo/redo, RTL e impressão ainda precisam desenvolvimento. Dezenas de colunas simultâneas podem ficar ilegíveis mesmo sem interseção geométrica. Viewports pequenas no Edge não comprovam comportamento físico de Safari/iOS/Android.

## Correção de cliques e prévia (continuação)

Cliques de ponteiro em slots vazios agora passam pela avaliação de constraints e ocupação, como o teclado e a seleção arrastada. Horários fora do expediente e bloqueios não abrem o editor. Nas grades de recursos, a seleção mantém o recurso e respeita seus buffers/capacidade. A prévia do mês é uma barra contínua por semana, reserva espaço e preserva o título da ocorrência; não cria cópias por dia. A timeline usa uma única linha de agora atravessando as linhas dos recursos. Mensagens do exemplo distinguem expediente, bloqueio, capacidade e preparação.

O exemplo configura uma reserva simultânea por sala e preparação de 15 minutos na Sala 1. Isso é uma regra de ocupação, não um limite de dois eventos na biblioteca. Sobreposição visual com 32 eventos simultâneos foi validada separadamente. Regressões de clique bloqueado, prévia de movimento/resize e linha contínua ficam em scripts/browser-interaction-regressions.js.

## Novas opções e limites desta rodada

- Capacidade global com substituição individual, inclusive false para ilimitado. A derivação visual passa a incluir eventos de dia inteiro na concorrência, como a avaliação de ocupação.
- Resize pelas duas extremidades, preservando a oposta, duração mínima e fim exclusivo; handles apenas nas extremidades reais visíveis.
- Prévia com título em grades verticais/timeline, ocultando a origem; popovers padrão podem iniciar drag.
- Grades verticais com políticas shrink/scroll/more; agrupamento do excesso em timeline horizontal permanece pendente.
- Conversão timed/allDay opt-in, conservando duração/dias conforme contrato da API; mudança de view preserva tipo.
- Cabeçalho acompanha scroll vertical da página; altura interna permanece opt-in. Foram medidos alinhamento0px e scrollTopinterno0 em quatro views no Edge375px.
- Decoração por getDayStyle independente de bloqueios.

A execução paralela de edições acionou HMR e interrompeu uma rodada de QA; a validação final deve ocorrer com arquivos estáveis. Não é evidência de falha do motor. Scripts de regressão agora distinguem alças start/end e incluem densidade, popover, capacidade herdada/individual e decoração visual.


Validação final desta rodada: `yarn verify` passou com 296 testes em 24 arquivos; `yarn test:browser` passou integralmente no Edge. Inclui arraste a partir dos popovers, resize pelo início/fim, capacidade herdada/individual/ilimitada, decoração sem bloqueio, conversão de tipo opt-in, cabeçalho no scroll da página, densidade e responsividade. Na timeline, compacto mediu 840 px e amplo 1680 px para a mesma janela de 14 horas, sem colisão entre os rótulos. Imagens inspecionadas: timeline-spacing-1.png, timeline-spacing-2.png e features-month-popover-drag.png.


Correção do eixo vertical: rótulos 2px abaixo das linhas, sem label de slot no limite exclusivo. Browser-axis-review mede os limites dos textos e confirma altura igual do último intervalo em Dia/Semana/Recursos. O servidor5173 foi inspecionado via fetch para confirmar a regra de timeLabelInterval explícito.
