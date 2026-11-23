export type AppViewportBounds = { top: number; height: number };
export type AppViewportGeometry = AppViewportBounds & {
  /** Height inside the host, including the portion Safari has panned above zero. */
  layoutHeight: number;
  occlusion: number;
};

/**
 * Safari owns native panning; never translate the app to counter it. Size from
 * the live host to the visible bottom so a panned form still fills that space.
 * VisualViewport offsets can lag native pan, so they are deliberately unused.
 */
export function appViewportGeometry(
  root: AppViewportBounds,
  viewport: { height: number; scale: number } | null,
): AppViewportGeometry {
  // Leave native pinch zoom in charge of both size and panning.
  if (!viewport || Math.abs(viewport.scale - 1) > 0.01)
    return { ...root, layoutHeight: root.height, occlusion: 0 };

  const top = Math.max(0, root.top);
  const height = Math.max(0, Math.min(root.top + root.height, viewport.height) - top);
  const layoutHeight = Math.max(0, Math.min(root.height, viewport.height - root.top));
  return { top, height, layoutHeight, occlusion: root.height - height };
}
