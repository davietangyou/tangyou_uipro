import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Mic } from "lucide-react";
import { useVoiceRecording } from "../hooks/useVoiceRecording";
import { VoiceRecordingBar } from "./VoiceRecordingBar";
import { readStored, writeStored } from "../services/storage";
import { flushPendingInputViewport, getInputViewportBounds } from "../services/inputViewport";
type Input = HTMLInputElement | HTMLTextAreaElement;
type Position = { x: number; y: number };
const SIZE = 60;
const inputSelector = 'textarea,input[type="text"],input:not([type]),input[type="number"],input[type="search"],input[type="tel"],input[type="email"],input[type="url"]';
function eligible(el: EventTarget | null): el is Input {
  return (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement && ["text", "search", "number", "tel", "email", "url"].includes(el.type)) && !el.disabled && !el.readOnly;
}
function visible(el: HTMLElement) { return el.getClientRects().length > 0 && !el.closest("[hidden],[inert]"); }
function bounds() {
  const root = document.getElementById("root")!.getBoundingClientRect();
  const viewport = window.visualViewport;
  const shared = getInputViewportBounds();
  // Use the shared visible client bounds for both app and portal hosts.
  // Native pinch zoom retains its own visual bounds.
  const zoomed = viewport && Math.abs(viewport.scale - 1) > .01;
  const visibleTop = zoomed ? viewport.offsetTop : shared?.top ?? root.top;
  const visibleHeight = zoomed ? viewport.height : shared?.height ?? root.height;
  const top = Math.max(root.top, visibleTop);
  const left = Math.max(root.left, viewport?.offsetLeft || 0);
  const right = Math.min(root.right, (viewport?.offsetLeft || 0) + (viewport?.width || innerWidth));
  let bottom = Math.min(root.bottom, visibleTop + visibleHeight);
  const nav = document.querySelector("nav.app-bottom-nav ul")?.getBoundingClientRect();
  if (nav && nav.height && nav.top < bottom && nav.bottom > top) {
    bottom = nav.top;
  }
  return { root, left: left - root.left + 12, top: top - root.top + 12, right: Math.max(left - root.left + 12, right - root.left - SIZE - 12), bottom: Math.max(top - root.top + 12, bottom - root.top - SIZE - 12) };
}
function clamp(p: Position) {
  const b = bounds();
  return { x: Math.max(b.left, Math.min(p.x, b.right)), y: Math.max(b.top, Math.min(p.y, b.bottom)) };
}
function storedVoicePosition() {
  try {
    const stored = readStored<Position | null>("voice_position", null);
    return stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)
      ? stored
      : null;
  } catch {
    return null;
  }
}
// The editor registers a preferred input, not a fixed visual dock.
export type VoiceDock = { node: HTMLElement; target: HTMLTextAreaElement };
export function FloatingVoice({ route, onToast, hidden = false, dock = null }: {
  route: string; onToast: (message: string) => void; hidden?: boolean; dock?: VoiceDock | null;
}) {
  const [preferred, setPreferred] = useState<Position>(() => {
    const b = bounds();
    return storedVoicePosition() ?? { x: b.right - 6, y: b.bottom - 4 };
  });
  const [position, setPosition] = useState(() => clamp(preferred));
  const positionRef = useRef(position); positionRef.current = position;
  const [modal, setModal] = useState<HTMLElement | null>(null);
  const [, setGeometry] = useState("");
  const [pressed, setPressed] = useState(false);
  const target = useRef<Input | null>(null), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const capture = useRef<{ input: Input; initial: string; start: number; end: number } | null>(null);
  const voice = useVoiceRecording({
    onError: onToast,
    onText: text => {
      const snapshot = capture.current;
      if (!snapshot) return;
      const { input, initial, start, end } = snapshot;
      if (!input.isConnected || !visible(input) || input.value !== initial) { onToast("輸入欄位已變更，請再點麥克風說話。"); return; }
      let spoken = text;
      if (input instanceof HTMLInputElement && (input.type === "number" || ["numeric", "decimal"].includes(input.inputMode))) {
        spoken = text.replace(/[，,]/g, "").replace(/點/g, ".").trim();
        if (!/^\d+(\.\d+)?$/.test(spoken)) { onToast("這個欄位只接受數字，請再說一次或直接輸入。"); return; }
      }
      let value = initial.slice(0, start) + spoken + initial.slice(end);
      if (input.maxLength > 0) value = value.slice(0, input.maxLength);
      Object.getOwnPropertyDescriptor(input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, "value")?.set?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      if (input instanceof HTMLTextAreaElement || ["text", "search", "url", "tel"].includes(input.type)) input.setSelectionRange(Math.min(start + spoken.length, value.length), Math.min(start + spoken.length, value.length));
      onToast("已填入文字，請確認後再保存。");
    },
  });
  const state = voice.stage;
  const press = useRef<{ x: number; y: number; origin: Position; drag: boolean; recording: boolean } | null>(null);
  const clearTimer = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };

  useLayoutEffect(() => {
    let frame=0;
    const runUpdate = () => {
      frame=0;
      // This listener can run before the controller's rAF; commit that pending frame once.
      flushPendingInputViewport();
      const voice=document.querySelector<HTMLElement>('[data-floating-voice] button');
      if(document.getElementById('device-shell')?.hasAttribute('data-keyboard-open') && (!voice || voice.dataset.voiceState==='idle'))return;
      setPosition(previous => { const next = clamp(preferred); return next.x === previous.x && next.y === previous.y ? previous : next; });
      const dialogs = Array.from(document.querySelectorAll<HTMLElement>('dialog[open],[role="dialog"][aria-modal="true"]')).filter(visible);
      const active = dialogs.at(-1) || null;
      setModal(active);
      const host = active || document.getElementById("device-overlay-layer") || document.body;
      const rect = host.getBoundingClientRect(), root = bounds().root;
      setGeometry([rect.left, rect.top, host.scrollLeft, host.scrollTop, root.left, root.top].join(":"));
    };
    const update=()=>{if(!frame)frame=requestAnimationFrame(runUpdate);};
    runUpdate();
    const observer = new MutationObserver(mutations => {
      if (mutations.some(mutation => !(mutation.target instanceof Element) ||
        !mutation.target.closest("[data-floating-voice]") &&
        (mutation.attributeName !== "style" || mutation.target.matches('dialog[open],[role="dialog"][aria-modal="true"]')))) update();
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["open", "hidden", "inert", "aria-modal", "data-active-view","data-keyboard-open", "style"] });
    const resize = new ResizeObserver(update); resize.observe(document.getElementById("root")!);
    const nav = document.querySelector("nav.app-bottom-nav ul"); if (nav) resize.observe(nav);
    window.addEventListener("resize", update);
    document.addEventListener("scroll", update, true);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => { cancelAnimationFrame(frame);observer.disconnect(); resize.disconnect(); window.removeEventListener("resize", update); document.removeEventListener("scroll", update, true); document.removeEventListener("focusin", update); document.removeEventListener("focusout", update); window.visualViewport?.removeEventListener("resize", update); window.visualViewport?.removeEventListener("scroll", update); };
  }, [preferred, route]);

  useEffect(() => {
    const focus = (event: FocusEvent) => { if (eligible(event.target)) target.current = event.target; };
    document.addEventListener("focusin", focus);
    return () => { clearTimer(); document.removeEventListener("focusin", focus); };
  }, []);
  useEffect(() => {
    clearTimer(); voice.cancel(); capture.current = null; press.current = null;
    target.current = dock?.target || (eligible(document.activeElement) ? document.activeElement : null);
    setPressed(false);
  }, [route, hidden, dock, modal]);

  const begin = () => {
    const input = dock?.target || target.current;
    if (voice.busy) return;
    if (!input?.isConnected || !eligible(input) || !visible(input) || modal && !modal.contains(input)) {
      onToast("先點選想輸入的欄位，再點麥克風說話。"); return;
    }
    capture.current = { input, start: input.selectionStart ?? input.value.length, end: input.selectionEnd ?? input.value.length, initial: input.value };
    if (press.current) press.current.recording = true;
    input.blur(); voice.start();
  };

  const down = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || state !== "idle") return;
    setPressed(true); event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    press.current = { x: event.clientX, y: event.clientY, origin: positionRef.current, drag: false, recording: false };
    timer.current = setTimeout(begin, 380);
  };
  const move = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const p = press.current; if (!p) return;
    const dx = event.clientX - p.x, dy = event.clientY - p.y;
    if (p.recording) return;
    if (Math.hypot(dx, dy) > 8) {
      p.drag = true; clearTimer();
      positionRef.current = clamp({ x: p.origin.x + dx, y: p.origin.y + dy }); setPosition(positionRef.current);
    }
  };
  const persistPosition = (next: Position) => {
    positionRef.current = next; setPosition(next); setPreferred(next);
    try { writeStored("voice_position", next); } catch { onToast("位置暫時未能保存；本次使用仍可拖動麥克風。"); }
  };
  const release = (cancel = false) => {
    setPressed(false); clearTimer(); const p = press.current; if (!p) return; press.current = null;
    if (p.recording) return;
    if (p.drag) persistPosition(positionRef.current);
    else if (!cancel) begin();
  };

  // Confirmation-only dialogs have no input. Leave their actions unobstructed.
  const modalInput = modal && Array.from(modal.querySelectorAll<HTMLElement>(inputSelector)).some(el => eligible(el) && visible(el));
  if (hidden || modal && !modalInput) return null;
  const b = bounds();
  const host = modal || document.getElementById("device-overlay-layer") || document.body;
  const rect = host.getBoundingClientRect();
  const offset = { x: b.root.left - rect.left + host.scrollLeft, y: b.root.top - rect.top + host.scrollTop };
  return createPortal(<><div data-floating-voice className={`floating-voice${route === "home" ? " is-home-route" : ""}`} style={{ left: offset.x + position.x, top: offset.y + position.y }} onClick={event => event.stopPropagation()}>
    <button type="button" hidden={voice.busy} data-pressed={pressed} data-voice-state={state} aria-label="語音輸入：點擊或長按說話，拖動移動" aria-pressed={state === "listening"} title="點擊或長按說話 · 拖動移動 · 方向鍵調整位置"
      onPointerDown={down} onPointerMove={move} onPointerUp={() => release()} onPointerCancel={() => release(true)} onLostPointerCapture={() => release(true)} onContextMenu={event => event.preventDefault()}
      onKeyDown={event => {
        const step = event.shiftKey ? 40 : 10;
        const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
        if (delta && state === "idle") { event.preventDefault(); persistPosition(clamp({ x: position.x + delta[0], y: position.y + delta[1] })); }
        if ((event.key === " " || event.key === "Enter") && !event.repeat && state === "idle") {
          setPressed(true); event.preventDefault(); press.current = { x: 0, y: 0, origin: position, drag: false, recording: false }; begin();
        }
        if (event.key === "Escape") { voice.cancel(); release(true); }
      }}
      onKeyUp={event => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); release(); } }}
      className={"voice-feedback floating-voice-button " + (state === "listening" ? "is-listening" : "")}>
      <Mic width={28} height={28} strokeWidth={1.8} aria-hidden="true" />
    </button>
  </div>{voice.busy && <div data-floating-voice className="floating-recording-panel" style={{left:offset.x+18,top:offset.y+b.bottom+SIZE,transform:"translateY(-100%)",width:Math.max(240,b.root.width-36)}}>
    <VoiceRecordingBar stage={state} fill numeric={capture.current?.input instanceof HTMLInputElement && capture.current.input.type === "number"}
      target={capture.current?.input.getAttribute("aria-label") || capture.current?.input.labels?.[0]?.textContent || "目前欄位"}
      onCancel={() => voice.cancel()} onStop={() => voice.stop()} onSubmit={() => voice.stop(true)} />
  </div>}</>, host);
}
