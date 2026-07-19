import { useEffect, useRef, type RefObject } from "react";

export function useDismissibleSurface<T extends HTMLElement>(
  open: boolean,
  close: () => void,
  {
    manageFocus = true,
    triggerRef,
  }: {
    manageFocus?: boolean;
    triggerRef?: RefObject<HTMLElement | null>;
  } = {},
): React.RefObject<T | null> {
  const surfaceRef = useRef<T>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  const previousFocusRef = useRef<HTMLElement | null>(null);

  if (
    open &&
    manageFocus &&
    previousFocusRef.current === null &&
    document.activeElement instanceof HTMLElement
  )
    previousFocusRef.current = document.activeElement;

  useEffect(() => {
    if (!open) return;
    const frame = manageFocus
      ? requestAnimationFrame(() => {
          surfaceRef.current?.focus();
        })
      : null;
    function handleKeyDown(event: globalThis.KeyboardEvent): void {
      if (document.querySelector('[aria-modal="true"]') !== null) return;
      if (event.key === "Escape") closeRef.current();
    }
    function handlePointerDown(event: PointerEvent): void {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (surfaceRef.current?.contains(target) === true) return;
      if (triggerRef?.current?.contains(target) === true) return;
      if (
        target instanceof Element &&
        target.closest('[aria-modal="true"]') !== null
      )
        return;
      closeRef.current();
    }
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [open, manageFocus, triggerRef]);

  return surfaceRef;
}
