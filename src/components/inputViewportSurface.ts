import type { CSSProperties } from "react";
import type { useAppViewport } from "../hooks/useAppViewport";
type Viewport = ReturnType<typeof useAppViewport>;

export function inputViewportAttributes(viewport: Viewport) {
  return {
    "data-input-active": viewport?.inputActive || undefined,
    "data-input-compact": viewport?.inputCompact || undefined,
    "data-keyboard-open": viewport?.keyboardOpen || undefined,
    "data-chrome-hidden": viewport?.chromeHidden || undefined,
    "data-chat-chrome-hidden": viewport?.chatChromeHidden || undefined,
  };
}

/** These declarations are stable throughout keyboard opening, closing and panel exit. */
export function inputViewportStyle(_viewport?: Viewport, portal = false): CSSProperties {
  const style: CSSProperties & { "--input-view-height": string } = {
    height: "var(--viewport-height, 100%)",
    "--input-view-height": "var(--viewport-height, 100%)",
  };
  if (portal) {
    style.top = 0;
    style.bottom = "auto";
  } else style.transform = "translateZ(0)";
  return style;
}
