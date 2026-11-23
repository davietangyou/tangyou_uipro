export type VerticalBounds = { top: number; bottom: number };

/** Geometry can classify an obstruction; it must never decide to blur a field. */
export function keyboardIsOpen(occlusion: number, wasOpen = false) {
  return wasOpen ? occlusion > 1 : occlusion > 120;
}

/** Navigation gives up exactly the space currently occupied by the keyboard. */
export function keyboardChromeProgress(occlusion: number, chromeHeight: number) {
  if (chromeHeight <= 0) return 1;
  return 1 - Math.max(0, Math.min(1, occlusion / chromeHeight));
}

/** Reveal the nearest edge; centering on every keyboard frame makes the form jump. */
export function fieldScrollDelta(
  field: VerticalBounds,
  view: VerticalBounds,
  padding = 16,
) {
  const room = view.bottom - view.top;
  if (room <= 0) return 0;
  const margin = Math.min(
    padding,
    Math.max(0, (room - (field.bottom - field.top)) / 2),
  );
  if (field.bottom - field.top > room) return field.top - view.top;
  if (field.bottom > view.bottom - margin)
    return field.bottom - view.bottom + margin;
  if (field.top < view.top + margin) return field.top - view.top - margin;
  return 0;
}

export function editableField(
  target: Element | null,
): target is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  const eligible =
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLInputElement &&
      [
        "text",
        "search",
        "number",
        "email",
        "tel",
        "url",
        "password",
        "date",
        "time",
        "datetime-local",
        "month",
        "week",
      ].includes(target.type));
  return (
    eligible &&
    !target.disabled &&
    !("readOnly" in target && target.readOnly) &&
    !!target.getClientRects().length &&
    !target.closest("[hidden],[inert]")
  );
}

/** Scroll form containers only. scrollIntoView also moves the document and Safari's camera. */
export function revealFieldInForm(
  field: HTMLElement,
  viewport: VerticalBounds,
) {
  if (field.closest(".chat-entry")) return;
  for (
    let scroller = field.parentElement;
    scroller && scroller !== document.body;
    scroller = scroller.parentElement
  ) {
    if (
      !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY) ||
      scroller.scrollHeight <= scroller.clientHeight + 1
    )
      continue;
    const rect = scroller.getBoundingClientRect();
    let top = Math.max(rect.top + scroller.clientTop, viewport.top),
      bottom = Math.min(rect.bottom, viewport.bottom);
    for (const bar of scroller.querySelectorAll<HTMLElement>(
      "header,footer,[data-input-obstruction]",
    )) {
      if (
        bar.contains(field) ||
        !bar.getClientRects().length ||
        bar.closest("[hidden],[inert]") ||
        getComputedStyle(bar).position !== "sticky"
      )
        continue;
      const box = bar.getBoundingClientRect();
      if (box.top <= top + 4 && box.bottom > top && box.bottom < bottom)
        top = box.bottom;
      if (box.bottom >= bottom - 24 && box.top > top && box.top < bottom)
        bottom = box.top;
    }
    const box = field.getBoundingClientRect();
    const label = field
      .closest<HTMLElement>(
        "label,.profile-field,.care-field,.question-note-input,.auth-field",
      )
      ?.getBoundingClientRect();
    const target =
      label && box.bottom - label.top <= bottom - top - 16
        ? { top: Math.min(box.top, label.top), bottom: box.bottom }
        : box;
    const delta = fieldScrollDelta(target, { top, bottom });
    if (Math.abs(delta) > 1) scroller.scrollTop += delta;
  }
}
