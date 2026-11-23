import { appViewportGeometry, type AppViewportBounds } from "../data/appViewport";
import { dismissInputOnBlankTap } from "./dismissInputOnBlankTap";
import { editableField, keyboardIsOpen, keyboardChromeProgress, revealFieldInForm } from "../data/inputViewport";

/** Only semantic changes reach React. Pixel geometry stays in shared CSS variables. */
export type InputViewportState = {
  inputActive: boolean;
  inputCompact: boolean;
  keyboardOpen: boolean;
  chatInputActive: boolean;
  chromeHidden: boolean;
  chatChromeHidden: boolean;
};
let snapshot: InputViewportState | null = null;
let bounds: AppViewportBounds | null = null;
const listeners = new Set<() => void>();
let stop: (() => void) | null = null;
let flushPending: (() => void) | null = null;

function start() {
  const canvas = document.getElementById("root");
  if (!canvas) return () => {};
  const shell = document.getElementById("device-shell") ?? canvas;
  const viewport = window.visualViewport;
  const removeBlankTap = dismissInputOnBlankTap(shell);
  let frame = 0, previousHeight = Infinity;
  let canvasWidth = 0, canvasHeight = 0;
  let keyboardOpen = false, discoverChrome = true;
  let observedField: HTMLElement | null = null;
  let previousFieldHeight = 0;
  let nav: HTMLElement | null = null;
  const chrome = new Map<HTMLElement, number>();
  const measure = new Set<HTMLElement>();
  // A collapsing slot measures its natural child, never its own controlled height.
  const content = (node: HTMLElement) => node.hasAttribute("data-keyboard-chrome")
    ? node.firstElementChild as HTMLElement ?? node : node;
  const sizes = new ResizeObserver(entries => {
    for (const entry of entries) {
      const target = entry.target as HTMLElement;
      const slot = chrome.has(target) ? target : target.parentElement;
      if (slot && chrome.has(slot)) measure.add(slot);
    }
    schedule();
  });
  const discover = () => {
    const nodes = new Set(canvas.querySelectorAll<HTMLElement>(
      ".app-bottom-nav,[data-keyboard-chrome]",
    ));
    for (const node of chrome.keys()) if (!nodes.has(node)) {
      sizes.unobserve(content(node));
      chrome.delete(node);
      measure.delete(node);
      node.style.removeProperty("--keyboard-chrome-height");
    }
    for (const node of nodes) if (!chrome.has(node)) {
      chrome.set(node, 0);
      measure.add(node);
      sizes.observe(content(node));
    }
    nav = canvas.querySelector(".app-bottom-nav");
    discoverChrome = false;
  };
  const write = (node: HTMLElement, name: string, value: string) => {
    if (node.style.getPropertyValue(name) !== value) node.style.setProperty(name, value);
  };
  function update() {
    frame = 0;
    if (discoverChrome) discover();
    // Read one snapshot before our writes; Safari owns the host's native pan.
    const rect = canvas.getBoundingClientRect();
    const canvasResized = rect.width !== canvasWidth || rect.height !== canvasHeight;
    canvasWidth = rect.width;
    canvasHeight = rect.height;
    const visual = viewport ? {
      height: viewport.height, scale: viewport.scale,
    } : null;
    const geometry = appViewportGeometry(rect, visual);
    const focused = editableField(document.activeElement) ? document.activeElement : null;
    const changedField = focused !== observedField;
    if (changedField) {
      if (observedField) sizes.unobserve(observedField);
      observedField = focused;
      if (focused) sizes.observe(focused);
    }
    const fieldHeight = focused?.offsetHeight ?? 0;
    const measured = Array.from(measure, node => [node, content(node).offsetHeight] as const);
    measure.clear();
    for (const [node, height] of measured) chrome.set(node, height);
    const navHeight = nav ? chrome.get(nav) ?? 0 : 0;
    keyboardOpen = keyboardIsOpen(geometry.occlusion, keyboardOpen);
    // Safari may report the old keyboard height until its dismissal animation
    // ends. Start restoring on blur, rather than snapping the whole app later.
    const height = focused ? geometry.layoutHeight : rect.height;
    const inputActive = !!focused;
    const chatInputActive = !!focused?.closest(".chat-entry");
    const progress = focused ? keyboardChromeProgress(geometry.occlusion, navHeight) : 1;
    const chatProgress = chatInputActive ? progress : 1;
    const next: InputViewportState = {
      inputActive,
      inputCompact: (focused ? geometry.height : rect.height) < 360,
      keyboardOpen,
      chatInputActive,
      chromeHidden: progress === 0,
      chatChromeHidden: chatProgress === 0,
    };

    // App and portal use the same height; neither counter-pans the native host.
    for (const [name, value] of Object.entries({
      // Rotation/window resizing must not leave navigation and voice using
      // different frames. Only keyboard changes animate inside a stable canvas.
      "--viewport-motion-duration": canvasResized ? "0ms" : "var(--motion-enter, 240ms)",
      "--viewport-height": `${height}px`,
      "--viewport-chrome-progress": String(progress),
      "--viewport-chat-progress": String(chatProgress),
      "--app-nav-height": `${navHeight}px`,
    })) write(shell, name, value);
    for (const [node, height] of measured) write(node, "--keyboard-chrome-height", `${height}px`);
    for (const node of chrome.keys()) {
      const hidden = (node.hasAttribute("data-keyboard-chrome") ? chatProgress : progress) === 0;
      if (node.inert !== hidden) node.inert = hidden;
    }
    bounds = { top: geometry.top, height: geometry.height };
    shell.toggleAttribute("data-keyboard-open", keyboardOpen);

    if (!snapshot || Object.keys(next).some(key =>
      next[key as keyof InputViewportState] !== snapshot![key as keyof InputViewportState],
    )) {
      snapshot = next;
      for (const listener of listeners) listener();
    }
    // A necessary post-write layout read reveals the field in its resized form,
    // never on viewport growth/closing or an ordinary user scroll.
    if (focused && (!visual || Math.abs(visual.scale - 1) < 0.01) &&
      (changedField || geometry.height < previousHeight - 1 || fieldHeight > previousFieldHeight + 1)) {
      revealFieldInForm(focused, { top: geometry.top, bottom: geometry.top + geometry.height });
    }
    previousHeight = geometry.height;
    previousFieldHeight = fieldHeight;
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }
  function updateNow() {
    cancelAnimationFrame(frame);
    update();
  }
  flushPending = () => {
    if (!frame) return;
    updateNow();
  };
  for (const event of ["focusin", "focusout", "input"]) document.addEventListener(event, schedule);
  for (const event of ["resize", "scroll"]) {
    // Commit native geometry before paint instead of adding a queued layout frame.
    window.addEventListener(event, updateNow);
    viewport?.addEventListener(event, updateNow);
  }
  const mutations = new MutationObserver(records => {
    if (records.some(record => record.type === "childList" || record.attributeName === "data-keyboard-chrome")) discoverChrome = true;
    // Hidden routes may become visible without mounting new chrome nodes.
    if (records.some(record => record.attributeName === "hidden" || record.attributeName === "data-active-view"))
      for (const node of chrome.keys()) measure.add(node);
    schedule();
  });
  mutations.observe(shell, {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ["data-active-view", "data-keyboard-chrome", "hidden", "inert", "disabled", "readonly", "open"],
  });
  sizes.observe(canvas);
  update();
  return () => {
    cancelAnimationFrame(frame);
    sizes.disconnect();
    mutations.disconnect();
    removeBlankTap();
    for (const node of chrome.keys()) {
      node.style.removeProperty("--keyboard-chrome-height");
      node.inert = false;
    }
    for (const name of ["--viewport-height", "--viewport-motion-duration", "--viewport-chrome-progress", "--viewport-chat-progress", "--app-nav-height"])
      shell.style.removeProperty(name);
    shell.removeAttribute("data-keyboard-open");
    for (const event of ["focusin", "focusout", "input"]) document.removeEventListener(event, schedule);
    for (const event of ["resize", "scroll"]) {
      window.removeEventListener(event, updateNow);
      viewport?.removeEventListener(event, updateNow);
    }
    snapshot = null;
    bounds = null;
    flushPending = null;
  };
}

export function subscribeInputViewport(listener: () => void) {
  listeners.add(listener);
  if (!stop) stop = start();
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      stop?.();
      stop = null;
    }
  };
}
export const getInputViewport = () => snapshot;
/** Actual visible client bounds, for overlays such as voice. */
export const getInputViewportBounds = () => bounds;
/** Geometry consumers call this in their frame callback, never during React render. */
export const flushPendingInputViewport = () => flushPending?.();
