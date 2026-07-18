import { useEffect, useRef } from "react";

export function useDismissibleSurface<T extends HTMLElement>(
  open: boolean,
  close: () => void,
  { manageFocus = true }: { manageFocus?: boolean } = {},
): React.RefObject<T | null> {
  const surfaceRef = useRef<T>(null);
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!open) return;
    const previousFocus =
      manageFocus && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const frame = manageFocus
      ? requestAnimationFrame(() => {
          surfaceRef.current?.focus();
        })
      : null;
    function handleKeyDown(event: globalThis.KeyboardEvent): void {
      if (event.key === "Escape") closeRef.current();
    }
    function handlePointerDown(event: PointerEvent): void {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (surfaceRef.current?.contains(target) === true) return;
      closeRef.current();
    }
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
      previousFocus?.focus();
    };
  }, [open, manageFocus]);

  return surfaceRef;
}
