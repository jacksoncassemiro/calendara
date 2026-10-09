import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from '@floating-ui/react';
import { useRef, type ReactNode } from 'react';
import { getViewLabels } from '../formatting/viewLabels.js';

/** Anchored, dismissible overflow content with managed focus.
 * @remarks Português: Conteúdo de excedentes ancorado e dispensável com foco gerenciado.
 */
export function MonthMorePopover({
  anchor,
  container,
  label,
  id,
  onClose,
  children,
  locale,
}: {
  /** Element that anchors the popover. @remarks Português: Elemento de referência do popover. */
  anchor: HTMLElement;
  /** Calendar root hosting the portal. @remarks Português: Raiz do calendário que recebe o portal. */
  container: HTMLElement;
  /** Display text. @remarks Português: Texto exibido. */
  label: string;
  /** Stable occurrence or DOM identifier. @remarks Português: Identificador estável da ocorrência ou do DOM. */
  id: string;
  /** Close the open popover. @remarks Português: Fecha o popover aberto. */
  onClose: () => void;
  /** Popover content. @remarks Português: Conteúdo do popover. */
  children: ReactNode;
  /** Language tag for labels. @remarks Português: Código de idioma dos rótulos. */
  locale?: string;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { refs, floatingStyles, context } = useFloating({
    open: true,
    onOpenChange: (open) => {
      if (!open) onClose();
    },
    elements: { reference: anchor },
    strategy: 'fixed',
    placement: 'bottom-start',
    whileElementsMounted: autoUpdate,
    middleware: [offset(8), flip(), shift({ padding: 8 })],
  });
  const { getFloatingProps } = useInteractions([useDismiss(context), useRole(context)]);
  return (
    <FloatingPortal root={container}>
      <FloatingFocusManager context={context} modal={false} initialFocus={headingRef} returnFocus>
        <div
          id={id}
          ref={refs.setFloating}
          style={floatingStyles}
          {...getFloatingProps({
            className: 'mc-month-popover',
            'aria-label': label,
          })}
        >
          <div className="mc-month-popover-header">
            <h3 ref={headingRef} tabIndex={-1}>
              {label}
            </h3>
            <button
              type="button"
              className="mc-view-btn"
              onClick={onClose}
              aria-label={getViewLabels(locale).closeEvents}
            >
              ×
            </button>
          </div>
          {children}
        </div>
      </FloatingFocusManager>
    </FloatingPortal>
  );
}
