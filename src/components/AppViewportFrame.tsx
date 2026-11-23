import type { CSSProperties, ReactNode } from "react";
import { useAppViewport } from "../hooks/useAppViewport";
import { inputViewportAttributes, inputViewportStyle } from "./inputViewportSurface";

/** Page contents do not subscribe to per-frame keyboard geometry. */
export function AppViewportFrame({ activeView, children }: { activeView: string; children: ReactNode }) {
  const viewport = useAppViewport();
  const style = {
    ...inputViewportStyle(),
    "--input-chrome-progress": "var(--viewport-chrome-progress, 1)",
  } as CSSProperties;
  return <div {...inputViewportAttributes(viewport)} data-active-view={activeView}
    data-chat-input-active={viewport?.chatInputActive || undefined}
    className="input-viewport-surface app-layout flex h-full flex-col bg-bg" style={style}>{children}</div>;
}
