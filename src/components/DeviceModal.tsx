import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useIsPresent, useReducedMotion, useDragControls } from 'motion/react';
import { lockAppInteraction } from './appInteractionLock';
import { useAppViewport } from '../hooks/useAppViewport';
import {inputViewportAttributes,inputViewportStyle} from './inputViewportSurface';

export const motionEnter = [0.2, 0.8, 0.2, 1] as const;
export const motionExit = [0.4, 0, 1, 1] as const;

// The overlay is a sibling of the app, so inert never disables the dialog itself.
function ModalSurface({ onClose, label, className, placement, children, autoFocus, returnFocusRef, swipeToDismiss }: {
  onClose: () => void; label: string; className: string;
  placement: 'sheet' | 'drawer' | 'center' | 'chart'; children: ReactNode; autoFocus: boolean;
  returnFocusRef?: RefObject<HTMLElement | null>; swipeToDismiss: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const close = useRef(onClose);
  close.current = onClose;
  const reduced = useReducedMotion();
  const present = useIsPresent();
  const viewport = useAppViewport();
  useLayoutEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const returnTo = returnFocusRef?.current ?? previous;
    const editor = previous?.closest<HTMLElement>('.profile-editor');
    const editorWasInert = editor?.inert ?? false;
    if (editor) editor.inert = true;
    const unlock = lockAppInteraction();
    const controls = () => Array.from(panel.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]',
    ) ?? []).filter(node => node.getClientRects().length && !node.closest('[inert]'));
    const firstInput = autoFocus ? panel.current?.querySelector<HTMLElement>('textarea, input:not([type="hidden"])') : null;
    (firstInput ?? panel.current)?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close.current(); }
      if (event.key !== 'Tab') return;
      const nodes = controls();
      const first = nodes[0], last = nodes.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
        event.preventDefault(); last?.focus({preventScroll:true});
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) {
        event.preventDefault(); first.focus({preventScroll:true});
      }
    };
    panel.current?.addEventListener('keydown', onKey);
    const node = panel.current;
    return () => {
      node?.removeEventListener('keydown', onKey);
      unlock();
      if (editor) editor.inert = editorWasInert;
      if (returnTo?.isConnected && !returnTo.closest('[hidden],[inert]'))
        returnTo.focus({ preventScroll: true });
    };
  }, [autoFocus, returnFocusRef]);
  const offset = placement === 'chart' ? { scale: reduced ? 1 : .98 } : placement === 'drawer' ? { x: reduced ? 0 : -24 } : { y: reduced ? 0 : 24 };
  return <div {...inputViewportAttributes(viewport)} className={`input-viewport-surface device-modal device-modal-${placement}`} style={inputViewportStyle(viewport,true)}>
    <motion.div className="device-modal-backdrop" aria-hidden="true" onClick={() => close.current()}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .12 }} />
    <motion.div ref={panel} role="dialog" aria-modal="true" aria-labelledby={label} tabIndex={-1} inert={!present}
      className={`device-modal-panel ${className}`} initial={{ opacity: 0, ...offset }}
      drag={swipeToDismiss ? "y" : false} dragControls={dragControls} dragListener={false}
      dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 1 }} dragMomentum={false}
      onPointerDownCapture={event => {
        if (swipeToDismiss && present && event.button === 0 && event.target instanceof Element && event.target.closest('[data-sheet-drag-handle]'))
          dragControls.start(event);
      }}
      onDragEnd={(_, info) => {
        if (swipeToDismiss && (info.offset.y >= 72 || info.offset.y > 16 && info.velocity.y > 500)) close.current();
      }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1, transition: { duration: reduced ? 0 : .24, ease: motionEnter } }}
      exit={{ opacity: 0, ...offset, ...(swipeToDismiss && !reduced ? { y: "100%" } : {}), transition: { duration: reduced ? 0 : .2, ease: motionExit } }}>
      {children}
    </motion.div>
  </div>;
}

export function DeviceModal({ open, onClose, label, className = '', placement = 'sheet', children, autoFocus = false, returnFocusRef, onExitComplete, swipeToDismiss = false }: {
  open: boolean; onClose: () => void; label: string; className?: string;
  placement?: 'sheet' | 'drawer' | 'center' | 'chart'; children: ReactNode; autoFocus?: boolean;
  returnFocusRef?: RefObject<HTMLElement | null>; onExitComplete?: () => void; swipeToDismiss?: boolean;
}) {
  return createPortal(<AnimatePresence onExitComplete={onExitComplete}>{open && <ModalSurface key="modal" onClose={onClose} label={label}
    className={className} placement={placement} autoFocus={autoFocus} returnFocusRef={returnFocusRef} swipeToDismiss={swipeToDismiss}>{children}</ModalSurface>}</AnimatePresence>,
  document.getElementById('device-overlay-layer') ?? document.body);
}
