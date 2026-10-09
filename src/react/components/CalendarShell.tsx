/** @jsxImportSource react */
/** Stable root, toolbar and active view body.
 * @remarks Português: Raiz estável, navegação e corpo da view ativa.
 */
import { createElement, type JSX } from 'react';
import type { ToolbarContext, ToolbarRenderSlot } from '../viewTypes.js';
import type { ReactNode } from 'react';

/** Navigation and content of the persistent calendar root.
 * @remarks Português: Navegação e conteúdo da raiz persistente do calendário.
 */
export interface ShellProps {
  /** Current navigation actions and title. @remarks Português: Ações de navegação e título atuais. */
  toolbar: ToolbarContext;
  /** Language tag for labels. @remarks Português: Código de idioma dos rótulos. */
  locale?: string;
  /** Visual reading direction; default ltr. @remarks Português: Direção visual; padrão ltr. */
  direction?: 'ltr' | 'rtl';
  /** Replace the built-in navigation content. @remarks Português: Substitui o conteúdo padrão da navegação. */
  renderToolbar?: ToolbarRenderSlot;
  /** Active view content. @remarks Português: Conteúdo da view ativa. */
  body: ReactNode;
}

export function CalendarShell(props: ShellProps): JSX.Element {
  const toolbar = props.renderToolbar
    ? props.renderToolbar(props.toolbar)
    : createElement(DefaultToolbar, {
        toolbar: props.toolbar,
        locale: props.locale,
        direction: props.direction,
      });
  return (
    <div
      className="mc-calendar"
      dir={props.direction ?? 'ltr'}
      data-mc-root
      data-mc-view={props.toolbar.viewName}
    >
      {toolbar}
      <div className="mc-view-body" data-mc-view-body>
        {props.body}
      </div>
    </div>
  );
}

function DefaultToolbar(props: {
  /** Visual reading direction. @remarks Português: Direção visual. */
  direction?: 'ltr' | 'rtl';
  /** Current navigation actions and title. @remarks Português: Ações de navegação e título atuais. */
  toolbar: ToolbarContext;
  /** Language tag for labels. @remarks Português: Código de idioma dos rótulos. */
  locale?: string;
}): JSX.Element {
  const { toolbar } = props;
  const english = props.locale?.startsWith('en') ?? false;
  return (
    <div
      className="mc-toolbar"
      data-mc-toolbar
      role="group"
      aria-label={english ? 'Calendar navigation' : 'Navegação do calendário'}
    >
      <div className="mc-toolbar-nav">
        <button
          type="button"
          className="mc-nav-prev"
          data-mc-nav-prev
          aria-label={english ? 'Previous period' : 'Período anterior'}
          onClick={() => toolbar.goPrev()}
        >
          {props.direction === 'rtl' ? '›' : '‹'}
        </button>
        <button
          type="button"
          className="mc-nav-today"
          data-mc-nav-today
          onClick={() => toolbar.goToday()}
        >
          {english ? 'Today' : 'Hoje'}
        </button>
        <button
          type="button"
          className="mc-nav-next"
          data-mc-nav-next
          aria-label={english ? 'Next period' : 'Próximo período'}
          onClick={() => toolbar.goNext()}
        >
          {props.direction === 'rtl' ? '‹' : '›'}
        </button>
      </div>

      <span className="mc-title" data-mc-title aria-live="polite">
        {toolbar.title}
      </span>

      <div
        className="mc-toolbar-views"
        role="group"
        aria-label={english ? 'Change view' : 'Trocar visualização'}
      >
        {toolbar.views.map((view) => {
          const isActive = view.name === toolbar.viewName;
          return (
            <button
              key={view.name}
              type="button"
              className={`mc-view-btn${isActive ? ' mc-active' : ''}`}
              data-mc-view-btn={view.name}
              aria-pressed={isActive}
              onClick={() => toolbar.changeView(view.name)}
            >
              {view.label}
            </button>
          );
        })}
      </div>
      <select
        className="mc-view-select"
        aria-label={english ? 'View' : 'Visualização'}
        value={toolbar.viewName}
        onChange={(event) => toolbar.changeView(event.currentTarget.value)}
      >
        {toolbar.views.map((view) => (
          <option key={view.name} value={view.name}>
            {view.label}
          </option>
        ))}
      </select>
    </div>
  );
}
