/* Generic overlay interaction behavior for design-system components: focus
   trapping, focus restoration, scroll locking, Escape-to-close, and optional
   outside-pointer dismissal. Adapted from src/app/deck/hooks.ts
   (useModalBehavior) — copied, not imported, so the design system stays
   standalone. */
import { useEffect, useRef } from "react";
import type { RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export interface ModalBehaviorOptions {
  /** Close when a pointerdown lands outside the surface (backdrop clicks). */
  closeOnOutsidePointerDown?: boolean;
}

function trapTab(surface: HTMLElement, event: KeyboardEvent): void {
  const focusable = [
    ...surface.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ];
  if (focusable.length === 0) {
    event.preventDefault();
    surface.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable.at(-1);
  if (first === undefined || last === undefined) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function useModalBehavior<T extends HTMLElement>(
  open: boolean,
  close: () => void,
  { closeOnOutsidePointerDown = false }: ModalBehaviorOptions = {},
): RefObject<T | null> {
  const surfaceRef = useRef<T>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Capture the trigger during render: React applies content autoFocus in
  // the commit phase, so by the time the effect below runs focus already
  // sits inside the dialog and the trigger would be lost.
  if (
    open &&
    previousFocusRef.current === null &&
    document.activeElement instanceof HTMLElement &&
    surfaceRef.current?.contains(document.activeElement) !== true
  ) {
    previousFocusRef.current = document.activeElement;
  }

  useEffect(() => {
    if (!open) return;
    if (
      previousFocusRef.current === null &&
      document.activeElement instanceof HTMLElement &&
      surfaceRef.current?.contains(document.activeElement) !== true
    ) {
      // StrictMode re-runs effects after a cleanup that already restored
      // (and cleared) the previous focus; re-capture it from outside the
      // surface so the eventual close still returns focus to the trigger.
      previousFocusRef.current = document.activeElement;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => {
      const surface = surfaceRef.current;
      const initialFocus =
        surface?.querySelector<HTMLElement>("[autofocus]") ??
        surface?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ??
        surface;
      initialFocus?.focus();
    });

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || surfaceRef.current === null) return;
      trapTab(surfaceRef.current, event);
    }

    function handlePointerDown(event: PointerEvent): void {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (surfaceRef.current?.contains(target) === true) return;
      closeRef.current();
    }

    document.addEventListener("keydown", handleKeyDown);
    if (closeOnOutsidePointerDown) {
      document.addEventListener("pointerdown", handlePointerDown);
    }
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [open, closeOnOutsidePointerDown]);

  return surfaceRef;
}
