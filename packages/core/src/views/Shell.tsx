/** @jsxImportSource preact */
/**
 * Shell do calendário: dono do nó raiz (`data-mc-root`), desenha a toolbar (padrão ou custom
 * via render-prop) e o corpo da view ativa. Fica estável entre navegação/troca de view — o Preact
 * reaproveita este nó e só troca o corpo (nada é recriado do zero).
 */
import { h as createElement, type JSX } from 'preact';
import type { ToolbarContext, ToolbarRenderSlot } from './viewDef.js';
import type { ComponentChildren } from 'preact';

export interface ShellProps {
  toolbar: ToolbarContext;
  renderToolbar?: ToolbarRenderSlot;
  body: ComponentChildren;
}

export function CalendarShell(props: ShellProps): JSX.Element {
  const toolbar = props.renderToolbar
    ? props.renderToolbar(props.toolbar)
    : createElement(DefaultToolbar, { toolbar: props.toolbar });
  return (
    <div class="mc-calendar" data-mc-root data-mc-view={props.toolbar.viewName}>
      {toolbar}
      <div class="mc-view-body" data-mc-view-body>
        {props.body}
      </div>
    </div>
  );
}

function DefaultToolbar(props: { toolbar: ToolbarContext }): JSX.Element {
  const { toolbar } = props;
  return (
    <div class="mc-toolbar" data-mc-toolbar role="toolbar" aria-label="Navegação do calendário">
      <div class="mc-toolbar-nav">
        <button
          type="button"
          class="mc-nav-prev"
          data-mc-nav-prev
          aria-label="Período anterior"
          onClick={() => toolbar.goPrev()}
        >
          ‹
        </button>
        <button type="button" class="mc-nav-today" data-mc-nav-today onClick={() => toolbar.goToday()}>
          Hoje
        </button>
        <button
          type="button"
          class="mc-nav-next"
          data-mc-nav-next
          aria-label="Próximo período"
          onClick={() => toolbar.goNext()}
        >
          ›
        </button>
      </div>

      <span class="mc-title" data-mc-title aria-live="polite">
        {toolbar.title}
      </span>

      <div class="mc-toolbar-views" role="group" aria-label="Trocar visualização">
        {toolbar.views.map((view) => {
          const isActive = view.name === toolbar.viewName;
          return (
            <button
              key={view.name}
              type="button"
              class={`mc-view-btn${isActive ? ' mc-active' : ''}`}
              data-mc-view-btn={view.name}
              aria-pressed={isActive}
              onClick={() => toolbar.changeView(view.name)}
            >
              {view.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
