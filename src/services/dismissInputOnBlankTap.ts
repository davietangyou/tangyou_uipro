import { editableField } from "../data/inputViewport";

const interactive =
  'input,textarea,select,button,a,label,summary,[role="button"],[role="link"],[role="slider"],[role="checkbox"],[role="radio"],[contenteditable]:not([contenteditable="false"]),[tabindex]:not([tabindex="-1"])';

/** Dismiss only a completed blank tap, never a scroll, selection or another control. */
export function dismissInputOnBlankTap(shell: HTMLElement) {
  let gesture: {
    id: number;
    x: number;
    y: number;
    field: HTMLElement;
    moved: boolean;
  } | null = null;
  const blank = (target: EventTarget | null) =>
    target instanceof Element &&
    shell.contains(target) &&
    !target.closest(interactive);
  const down = (event: PointerEvent) => {
    gesture =
      event.isPrimary &&
      event.button === 0 &&
      blank(event.target) &&
      editableField(document.activeElement)
        ? {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            field: document.activeElement,
            moved: false,
          }
        : null;
  };
  const move = (event: PointerEvent) => {
    if (
      gesture?.id === event.pointerId &&
      Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8
    )
      gesture.moved = true;
  };
  const cancel = () => {
    gesture = null;
  };
  const up = (event: PointerEvent) => {
    const tap = gesture;
    gesture = null;
    if (
      !tap ||
      tap.id !== event.pointerId ||
      tap.moved ||
      !blank(event.target) ||
      Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 8 ||
      !window.getSelection()?.isCollapsed ||
      document.activeElement !== tap.field
    )
      return;
    // No preventDefault, scrollTo or deferred second blur: the native keyboard
    // starts retreating once, before the compatibility click is dispatched.
    tap.field.blur();
  };
  document.addEventListener("pointerdown", down, true);
  document.addEventListener("pointermove", move, true);
  document.addEventListener("pointerup", up, true);
  document.addEventListener("pointercancel", cancel, true);
  return () => {
    document.removeEventListener("pointerdown", down, true);
    document.removeEventListener("pointermove", move, true);
    document.removeEventListener("pointerup", up, true);
    document.removeEventListener("pointercancel", cancel, true);
  };
}
