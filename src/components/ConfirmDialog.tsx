import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { DangerButton, SecondaryButton } from "./buttons";
import { useAppViewport } from "../hooks/useAppViewport";
import {
  inputViewportAttributes,
  inputViewportStyle,
} from "./inputViewportSurface";
import { lockAppInteraction } from "./appInteractionLock";
import { revealFieldInForm } from "../data/inputViewport";
import { getInputViewportBounds } from "../services/inputViewport";

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "確定刪除",
  appearance,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  appearance?: "chat" | "profile" | "record";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);
  const viewport = useAppViewport(open);
  const cancel = useRef(onCancel);
  cancel.current = onCancel;

  useLayoutEffect(() => {
    if (!open) return;

    // Store the element that was focused before the dialog opened
    prevFocusRef.current = document.activeElement as HTMLElement;
    const unlock = lockAppInteraction();
    const panel = dialogRef.current;
    const revealFocused = () => {
      const focused = document.activeElement;
      const bounds = getInputViewportBounds();
      if (bounds && focused instanceof HTMLElement && panel?.contains(focused))
        revealFieldInForm(focused, { top: bounds.top, bottom: bounds.top + bounds.height });
    };
    const focus = (node: HTMLElement | undefined) => {
      node?.focus({ preventScroll: true });
      revealFocused();
    };

    // Move focus inside — onto the cancel button (safer default for destructive dialogs)
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const last = focusable?.[focusable.length - 1];
    focus(last);
    const resize = new ResizeObserver(revealFocused);
    if (panel) resize.observe(panel);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cancel.current();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const all = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      );
      const first = all[0];
      const lastEl = all[all.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        focus(lastEl);
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        focus(first);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      resize.disconnect();
      unlock();
      // Return focus to the element that triggered the dialog
      const previous = prevFocusRef.current;
      if (previous?.isConnected && !previous.closest("[hidden],[inert]"))
        previous.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      {...inputViewportAttributes(viewport)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dlg-title"
      aria-describedby="confirm-dlg-desc"
      className={appearance === "record" ? "input-viewport-surface record-confirm" : appearance === "chat" ? "input-viewport-surface chat-new-dialog" : appearance === "profile" ? "input-viewport-surface profile-scope profile-confirm" : "input-viewport-surface fixed inset-0 z-50 flex items-end justify-center bg-text-primary/40 p-4 sm:items-center"}
      style={{
        ...inputViewportStyle(viewport, true),
        overscrollBehavior: "contain",
      }}
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        className={appearance === "record" ? "record-confirm-panel" : appearance === "profile" ? "profile-confirm-panel" : "min-h-0 max-h-full w-full max-w-[440px] overflow-y-auto rounded-[24px] bg-surface p-6 shadow-[0_8px_24px_rgba(46,70,120,0.16)]"}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-dlg-title" className={appearance === "profile" ? "profile-confirm-title" : "t-section text-text-primary"}>
          {title}
        </h2>
        <p id="confirm-dlg-desc" className={appearance === "profile" ? "profile-help" : "t-body mt-2 text-text-secondary"}>
          {message}
        </p>
        {appearance === "record" ? <div className="record-confirm-actions">
          <button type="button" className="record-confirm-delete" onClick={onConfirm}>{confirmText}</button>
          <button type="button" onClick={onCancel}>取消</button>
        </div> : appearance === "chat" ? <div className="chat-new-dialog-actions">
          <button type="button" onClick={onConfirm}>{confirmText}</button>
          <button type="button" onClick={onCancel}>取消</button>
        </div> : appearance === "profile" ? <div className="profile-confirm-actions">
          <button type="button" className="profile-save" onClick={onConfirm}>{confirmText}</button>
          <button type="button" className="profile-setup-later" onClick={onCancel}>取消</button>
        </div> : <div className="mt-6 flex flex-col gap-3">
            <DangerButton fullWidth onClick={onConfirm}>{confirmText}</DangerButton>
            <SecondaryButton fullWidth onClick={onCancel}>取消</SecondaryButton>
          </div>}
      </div>
    </div>,
    document.getElementById("device-overlay-layer") ?? document.body,
  );
}
