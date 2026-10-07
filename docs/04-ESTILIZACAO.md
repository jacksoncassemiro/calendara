# 04 — Estilização e customização

Como o calendário é estilizado e como o app consumidor customiza a aparência.

## Princípio: geometria inline, aparência por classe

O **core** só escreve **geometria** inline (posição/tamanho absolutos: `top`/`height`/`left`/`width`/`flex`) — isso precisa existir no DOM independentemente de qualquer CSS carregado, senão o calendário "desmonta" sem folha de estilo. Toda a **aparência** (cor, borda, tipografia, raio, espaçamento, estados) vem do pacote `@meucalendario/calendar/styles.css`, via classes `mc-*` que consomem **tokens** (CSS custom properties `--mc-*`).

Consequência prática: para trocar a cara do calendário, **quase nunca** se reescreve regra CSS — redefine-se os **tokens** sob `[data-mc-root]`. Tudo é escopado por `[data-mc-root]` para não colidir com o CSS do app (ex.: Tailwind).

A única exceção onde há cor inline é quando o evento traz `event.color` — nesse caso o core aplica `background-color` inline no bloco (precedência sobre o token de cor de evento), como esperado.

No sentido inverso há **uma** exceção, só no tema: dentro de `.mc-hscroll`, a calha (`mc-time-axis`, `mc-timeline-label`, …) recebe `position: sticky !important`, sobrepondo o `position: relative` inline do core. É seguro porque `sticky` é superconjunto de `relative` — mesmo bloco contêiner para os filhos absolutos e nenhum deslocamento enquanto não gruda. Nenhuma outra regra do tema toca em `position`/`top`/`height`/`left`/`width`.

## Uso

```ts
import '@meucalendario/calendar/styles.css';          // ou '@meucalendario/calendar/styles.css/index.css'
```

## Customização por tokens (recomendado)

Redefina os tokens no seu CSS, com um seletor de igual ou maior especificidade:

```css
[data-mc-root] {
  --mc-color-event-bg: #e0f2fe;
  --mc-color-event-fg: #075985;
  --mc-color-event-border: #7dd3fc;
  --mc-color-now: #f59e0b;
  --mc-radius: 10px;
  --mc-font-family: "Inter", sans-serif;
}
```

### Tokens disponíveis

| Token | Papel | Default |
|---|---|---|
| `--mc-color-bg` | fundo do calendário | `#ffffff` |
| `--mc-color-fg` | texto principal | `#1a1a1a` |
| `--mc-color-muted` | rótulos secundários (weekday, horas, list-time) | `#6b7280` |
| `--mc-color-border` | bordas/linhas divisórias | `#e2e2e2` |
| `--mc-color-business` | fundo dentro do expediente | `#ffffff` |
| `--mc-color-nonbusiness` | sombreado fora do expediente | `#f6f6f6` |
| `--mc-color-blocked` | faixa/dia bloqueado (aceita gradiente) | hachura cinza |
| `--mc-color-buffer` | banda de buffer de recurso | hachura âmbar |
| `--mc-color-hourline` | linhas de hora | `#eeeeee` |
| `--mc-color-now` | linha "agora" | `#ea4335` |
| `--mc-color-today-bg` | fundo da coluna de hoje | `#eff6ff` |
| `--mc-color-event-bg` / `-fg` / `-border` | evento sem cor própria | azul claro |
| `--mc-color-draft-valid-bg` / `-border` | fantasma de gesto VÁLIDO | azul translúcido |
| `--mc-color-draft-invalid-bg` / `-border` | fantasma de gesto INVÁLIDO | vermelho translúcido |
| `--mc-color-overcapacity` | lotação estourada (badge + título do recurso) | `#dc2626` |
| `--mc-color-toolbar-bg` | fundo da toolbar | `transparent` |
| `--mc-color-btn-bg` / `-fg` | botões da toolbar | cinza claro |
| `--mc-color-btn-active-bg` / `-fg` | view ativa | azul |
| `--mc-font-family` | fonte | system-ui |
| `--mc-font-size` / `--mc-font-size-sm` | tamanhos | `14px` / `12px` |
| `--mc-radius` / `--mc-event-radius` | raios de canto | `6px` / `4px` |
| `--mc-gap` | espaçamento base | `6px` |
| `--mc-touch-target` | altura/largura mínima dos botões da toolbar | `0px` (→ `44px` em toque/tela estreita) |
| `--mc-day-min-width` | piso de largura da coluna de **dia** | `0px` (→ `104px` em ≤ 640px) |
| `--mc-resource-min-width` | piso de largura da coluna de **recurso** | `0px` (→ `140px` em ≤ 640px) |

## Responsivo / mobile

Tudo o que é responsivo vive **só no CSS** (`styles.css`). O core não conhece
breakpoint, não mede viewport e não troca de view sozinho — continua escrevendo apenas geometria
inline. Um app que não carrega o tema tem o mesmo DOM de sempre.

### A decisão, em uma frase

**Piso de rolagem no core + troca de view recomendada ao app.** O calendário garante que nunca fica
ilegível (colunas ganham largura mínima e o grid rola na horizontal, como o `dayMinWidth` do
FullCalendar); trocar Semana→Dia/Agenda no celular (padrão Schedule-X) é a UX preferida, mas fica
com o app — o core não impõe. Comparativo dos concorrentes em `reference/referencias-open-source.md`.

### Breakpoints

Só dois, e propositalmente independentes:

| Condição | O que muda |
|---|---|
| `(pointer: coarse)` **ou** `(max-width: 640px)` | `--mc-touch-target: 44px` — botões de navegação e de view passam a respeitar o alvo de toque (WCAG 2.5.5, guias iOS/Android). Pega tablet com dedo sem inchar a densidade do desktop. |
| `(max-width: 640px)` | `--mc-day-min-width: 104px` e `--mc-resource-min-width: 140px` (rolagem horizontal); toolbar quebra em duas linhas (título em cima, navegação + views embaixo); Mês aperta tipografia e ganha `min-height` tocável na célula; Agenda empilha hora acima do título. |

Não há terceiro breakpoint de propósito: de 641px pra cima 7 colunas já cabem com folga.

### Rolagem horizontal (`mc-hscroll`)

O core envolve **todas as faixas** de uma view (cabeçalho + dia-inteiro + corpo; na Multiagenda,
cabeçalho + corpo; na Timeline, cabeçalho + linhas) num único `<div class="mc-hscroll">`. É a única
mudança estrutural: um wrapper, sem geometria inline. Ela existe porque as faixas são irmãs `flex`
independentes — se cada uma rolasse sozinha, o rótulo do dia sairia de cima da sua coluna no meio do
scroll. Estando no mesmo scroller, rolam em lockstep.

Para o alinhamento se manter **exato**, o tema garante que toda coluna contribua com a mesma largura:
`min-width: var(--mc-day-min-width)` nas células e `contain: inline-size` no cabeçalho do dia, na
célula de dia-inteiro e no cabeçalho de recurso — sem isso, um título de evento longo (`nowrap`)
faria só a faixa dele ficar mais larga. A calha (eixo de horas / rótulo do recurso) fica `sticky` à
esquerda, para as horas não sumirem quando se rola até os últimos dias.

Com os tokens em `0px` (default, desktop) nada disso tem efeito: o `flex: 1 1 0` inline do core manda
como sempre e não há barra de rolagem.

**Limitação conhecida (fase de interação por toque):** as colunas do grid trazem `touch-action: none`
inline — contrato do InteractionEngine para arrastar/redimensionar. Enquanto isso não for revisto, o
swipe horizontal **com o dedo** só pega no cabeçalho, na faixa dia-inteiro ou na barra de rolagem;
sobre a coluna, o dedo é do gesto de arrastar. No desktop (mouse/trackpad) a rolagem é normal.

### Recomendação ao app (não é regra do core)

Rolar é o **piso**, não o ideal. Num celular, o melhor ainda é a view certa:

```ts
const isPhone = window.matchMedia('(max-width: 640px)').matches;
calendar.changeView(isPhone ? 'day' : 'week');   // ou 'list' para agenda
```

Mês e Agenda **não** rolam: Mês precisa ser lido de relance (a grade inteira encolhe a tipografia em
vez de rolar) e Agenda já é uma coluna vertical única — no celular ela só empilha hora e título.

### O que o app pode sobrescrever

Redefinindo os tokens, sem tocar em regra nenhuma:

```css
/* colunas mais largas no celular (2 dias por tela em vez de ~3) */
@media (max-width: 640px) {
  [data-mc-root] { --mc-day-min-width: 150px; }
}
/* alvo de toque de 44px SEMPRE, inclusive no desktop */
[data-mc-root] { --mc-touch-target: 44px; }
/* desligar a rolagem horizontal e voltar a espremer as colunas */
@media (max-width: 640px) {
  [data-mc-root] { --mc-day-min-width: 0px; }
}
```

## Customização por classe (avançado)

Se um token não cobrir o que você precisa, mire a classe direto (sempre sob `[data-mc-root]`). Não altere `position/top/height/left/width` — isso é geometria do core.

```css
[data-mc-root] .mc-event { box-shadow: 0 1px 2px rgba(0,0,0,.12); }
[data-mc-root] .mc-view-btn.mc-active { font-weight: 700; }
```

### Classes por área

- **Raiz/estrutura:** `mc-calendar` (raiz, tem `[data-mc-root]`), `mc-view-body`, `mc-hscroll` (scroller horizontal compartilhado pelas faixas do time-grid / Multiagenda / Timeline).
- **Toolbar:** `mc-toolbar`, `mc-toolbar-nav`, `mc-toolbar-views`, `mc-title`, `mc-nav-prev`, `mc-nav-today`, `mc-nav-next`, `mc-view-btn` (+ `mc-active`).
- **Cabeçalho/dia-inteiro:** `mc-header-row`, `mc-day-header` (+ `mc-today`), `mc-weekday`, `mc-daynum`, `mc-allday-row`, `mc-allday-label`, `mc-allday-cell`, `mc-allday-event`.
- **Corpo (time-grid):** `mc-body`, `mc-time-axis`, `mc-hour-label`, `mc-hour-line`, `mc-day-col` (+ `mc-today`), `mc-gutter-corner`, `mc-gutter-label`.
- **Camadas de fundo:** `mc-nonbusiness`, `mc-blocked`, `mc-buffer`.
- **Eventos:** `mc-event` (+ `mc-editable`), `mc-event-time`, `mc-event-title`, `mc-resize-handle`.
- **Linha "agora":** `mc-now-line`.
- **Fantasma do gesto:** `mc-draft` + `mc-draft-valid` | `mc-draft-invalid` (+ modificador `mc-draft-move` | `mc-draft-resize` | `mc-draft-select`).
- **Recursos:** `mc-resources`, `mc-resource-header-row`, `mc-resource-header` (+ `mc-over-capacity`), `mc-resource-title`, `mc-resource-col` (+ `mc-over-capacity`), `mc-capacity-badge`.
- **Timeline:** `mc-timeline`, `mc-timeline-header`, `mc-timeline-corner`, `mc-timeline-axis`, `mc-timeline-hour`, `mc-timeline-row` (+ `mc-over-capacity`), `mc-timeline-label`, `mc-timeline-track`.
- **Lista/Agenda:** `mc-list`, `mc-list-day`, `mc-list-day-header`, `mc-list-item`, `mc-list-time`, `mc-list-title`, `mc-list-empty`.
- **Mês:** `mc-month`, `mc-month-weekdays`, `mc-month-weekday`, `mc-month-week`, `mc-month-day`, `mc-month-daynum`, `mc-month-events`, `mc-month-event`.

## Hooks de seleção (`data-mc-*`)

Além das classes de estilo, o core emite atributos `data-mc-*` estáveis, úteis para **CSS avançado, testes (E2E) e a interação** (o InteractionEngine faz hit-test por eles). Não os use para layout, mas são um contrato estável:

`data-mc-root`, `data-mc-view`, `data-mc-view-body`, `data-mc-hscroll`, `data-mc-toolbar`, `data-mc-title`, `data-mc-nav-prev/today/next`, `data-mc-view-btn`, `data-mc-day`, `data-mc-day-header`, `data-mc-body`, `data-mc-allday`, `data-mc-allday-cell`, `data-mc-allday-event`, `data-mc-event`, `data-mc-start-min`, `data-mc-end-min`, `data-mc-editable`, `data-mc-resize`, `data-mc-draft`, `data-mc-draft-valid`, `data-mc-nonbusiness`, `data-mc-blocked`, `data-mc-buffer`, `data-mc-now`, `data-mc-resource`, `data-mc-resource-header`, `data-mc-over-capacity`, `data-mc-timeline-row`, `data-mc-list-day/item/empty`, `data-mc-month-day/event`.

> Nota: `data-mc-start-min`/`data-mc-end-min`/`data-mc-editable`/`data-mc-resize` são consumidos pelo InteractionEngine (Fase 4) para mover/redimensionar — não remova ao customizar.

## Conteúdo customizado (sem CSS)

Para trocar o **conteúdo** (não só o estilo) de um evento ou da toolbar, use os slots do core (`renderEvent`, `renderToolbar`) ou, no React, `renderEvent`/`customToolbar` do `<Calendar/>` e `createReactView` para uma view inteira.
