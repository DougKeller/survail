import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function useModalBehavior<T extends HTMLElement>(
  open: boolean,
  close: () => void,
): React.RefObject<T | null> {
  const surfaceRef = useRef<T>(null);
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!open) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
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

    function handleKeyDown(event: globalThis.KeyboardEvent): void {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || surfaceRef.current === null) return;
      const focusable = [
        ...surfaceRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ];
      if (focusable.length === 0) {
        event.preventDefault();
        surfaceRef.current.focus();
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

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open]);

  return surfaceRef;
}

export function useDismissibleSurface<T extends HTMLElement>(
  open: boolean,
  close: () => void,
): React.RefObject<T | null> {
  const surfaceRef = useRef<T>(null);
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!open) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const frame = requestAnimationFrame(() => {
      surfaceRef.current?.focus();
    });
    function handleKeyDown(event: globalThis.KeyboardEvent): void {
      if (event.key === "Escape") closeRef.current();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [open]);

  return surfaceRef;
}
