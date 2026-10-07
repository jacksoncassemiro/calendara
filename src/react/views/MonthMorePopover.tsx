import { useRef, type ReactNode } from 'react';
import { useFloating, offset, flip, shift, autoUpdate, useDismiss, useRole, useInteractions, FloatingPortal, FloatingFocusManager } from '@floating-ui/react';

export function MonthMorePopover({anchor,container,label,id,onClose,children}:{
  anchor:HTMLElement;container:HTMLElement;label:string;id:string;onClose:()=>void;children:ReactNode;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const {refs,floatingStyles,context} = useFloating({open:true,onOpenChange:open=>{if(!open)onClose();},
    elements:{reference:anchor},strategy:'fixed',placement:'bottom-start',whileElementsMounted:autoUpdate,
    middleware:[offset(8),flip(),shift({padding:8})]});
  const {getFloatingProps} = useInteractions([useDismiss(context),useRole(context)]);
  return <FloatingPortal root={container}><FloatingFocusManager context={context} modal={false} initialFocus={headingRef} returnFocus>
    <div id={id} ref={refs.setFloating} style={floatingStyles} {...getFloatingProps({className:'mc-month-popover', 'aria-label':label})}>
      <div className="mc-month-popover-header"><h3 ref={headingRef} tabIndex={-1}>{label}</h3>
        <button type="button" className="mc-view-btn" onClick={onClose} aria-label="Fechar lista de eventos">×</button></div>
      {children}
    </div>
  </FloatingFocusManager></FloatingPortal>;
}
