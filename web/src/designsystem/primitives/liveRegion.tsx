/* Visually hidden polite live region for announcing async work
   ("Working") without any visual footprint. */
import type { ReactNode } from "react";

import "./liveRegion.css";

export interface LiveRegionProps {
  children?: ReactNode;
}

/** Screen-reader-only aria-live=polite announcement region. */
export function LiveRegion({ children }: LiveRegionProps) {
  return (
    <div aria-atomic="true" aria-live="polite" className="ds-live-region">
      {children}
    </div>
  );
}
