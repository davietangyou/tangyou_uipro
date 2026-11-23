import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';
import { ChevronDownIcon } from './icons';

export function AnimatedDisclosure({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const body = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const animation = useRef<Animation | null>(null);
  const reduced = useReducedMotion();
  const revealFrame = useRef(0);
  useEffect(() => () => { cancelAnimationFrame(revealFrame.current); animation.current?.cancel(); }, []);
  const reveal = () => {
    const field = content.current?.querySelector<HTMLElement>('.care-field');
    const scroller = body.current?.closest('main, .profile-editor-scroll');
    if (!field || !scroller) return;
    const bounds = scroller.getBoundingClientRect();
    const actions = scroller.querySelector('.med-wizard-actions')?.getBoundingClientRect();
    const visibleBottom = Math.min(bounds.bottom, actions?.top ?? bounds.bottom) - 16;
    const label = field.getBoundingClientRect();
    const bottom = Math.min(label.bottom, label.top + 96);
    if (bottom > visibleBottom) scroller.scrollBy({ top: bottom - visibleBottom, behavior: 'auto' });
  };
  useLayoutEffect(() => {
    const node = body.current;
    if (!node) return;
    cancelAnimationFrame(revealFrame.current);
    const height = node.getBoundingClientRect().height;
    animation.current?.cancel();
    node.hidden = false;
    const target = open ? content.current?.getBoundingClientRect().height ?? 0 : 0;
    node.style.height = `${target}px`;
    if (first.current || reduced) {
      first.current = false;
      node.hidden = !open;
      if (open) { node.style.height = 'auto'; revealFrame.current = requestAnimationFrame(reveal); }
      return;
    }
    const effect = node.animate([{ height: `${height}px` }, { height: `${target}px` }],
      { duration: 200, easing: 'cubic-bezier(.2,.8,.2,1)' });
    animation.current = effect;
    // Reveal along with expansion; a second smooth scroll after it ends causes
    // a pause followed by another movement, especially above the keyboard.
    if (open) {
      const followExpansion = () => {
        reveal();
        if (effect.playState === 'running') revealFrame.current = requestAnimationFrame(followExpansion);
      };
      revealFrame.current = requestAnimationFrame(followExpansion);
    }
    effect.onfinish = () => {
      node.hidden = !open;
      if (!open) return;
      node.style.height = 'auto';
      reveal();
    };
  }, [open, reduced]);
  return <section className="med-basic-extra animated-disclosure">
    <button type="button" className="disclosure-trigger" data-voice-avoid aria-expanded={open} aria-controls={id}
      onClick={() => setOpen(value => !value)}><span>{title}</span><ChevronDownIcon width={20} height={20} /></button>
    <div ref={body} id={id} inert={!open} className="disclosure-body"><div ref={content}>{children}</div></div>
  </section>;
}
