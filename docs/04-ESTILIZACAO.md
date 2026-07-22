# 04 — Estilização e customização

Como o calendário é estilizado e como o app consumidor customiza a aparência.

## Princípio: geometria inline, aparência por classe

O **core** só escreve **geometria** inline (posição/tamanho absolutos: `top`/`height`/`left`/`width`/`flex`) — isso precisa existir no DOM independentemente de qualquer CSS carregado, senão o calendário "desmonta" sem folha de estilo. Toda a **aparência** (cor, borda, tipografia, raio, espaçamento, estados) vem do pacote `@meucalendario/styles`, via classes `mc-*` que consomem **tokens** (CSS custom properties `--mc-*`).

Consequência prática: para trocar a cara do calendário, **quase nunca** se reescreve regra CSS — redefine-se os **tokens** sob `[data-mc-root]`. Tudo é escopado por `[data-mc-root]` para não colidir com o CSS do app (ex.: Tailwind).

A única exceção onde há cor inline é quando o evento traz `event.color` — nesse caso o core aplica `background-color` inline no bloco (precedência sobre o token de cor de evento), como esperado.

## Uso

```ts
import '@meucalendario/styles';          // ou '@meucalendario/styles/index.css'
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

## Customização por classe (avançado)

Se um token não cobrir o que você precisa, mire a classe direto (sempre sob `[data-mc-root]`). Não altere `position/top/height/left/width` — isso é geometria do core.

```css
[data-mc-root] .mc-event { box-shadow: 0 1px 2px rgba(0,0,0,.12); }
[data-mc-root] .mc-view-btn.mc-active { font-weight: 700; }
```

### Classes por área

- **Raiz/estrutura:** `mc-calendar` (raiz, tem `[data-mc-root]`), `mc-view-body`.
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

`data-mc-root`, `data-mc-view`, `data-mc-view-body`, `data-mc-toolbar`, `data-mc-title`, `data-mc-nav-prev/today/next`, `data-mc-view-btn`, `data-mc-day`, `data-mc-day-header`, `data-mc-body`, `data-mc-allday`, `data-mc-allday-cell`, `data-mc-allday-event`, `data-mc-event`, `data-mc-start-min`, `data-mc-end-min`, `data-mc-editable`, `data-mc-resize`, `data-mc-draft`, `data-mc-draft-valid`, `data-mc-nonbusiness`, `data-mc-blocked`, `data-mc-buffer`, `data-mc-now`, `data-mc-resource`, `data-mc-resource-header`, `data-mc-over-capacity`, `data-mc-timeline-row`, `data-mc-list-day/item/empty`, `data-mc-month-day/event`.

> Nota: `data-mc-start-min`/`data-mc-end-min`/`data-mc-editable`/`data-mc-resize` são consumidos pelo InteractionEngine (Fase 4) para mover/redimensionar — não remova ao customizar.

## Conteúdo customizado (sem CSS)

Para trocar o **conteúdo** (não só o estilo) de um evento ou da toolbar, use os slots do core (`renderEvent`, `renderToolbar`) ou, no React, `renderEvent`/`customToolbar` do `<Calendar/>` e `createReactView` para uma view inteira.
