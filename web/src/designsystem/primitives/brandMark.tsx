/* Brand mark — the accent app-icon square from wireframe 1a. Decorative:
   always paired with the visible wordmark, so it stays aria-hidden. */
import type { ReactNode } from "react";

import "./brandMark.css";

function LayersGlyph() {
  return (
    <svg
      fill="none"
      height="30"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.75"
      viewBox="0 0 24 24"
      width="30"
    >
      <path d="M3 7l9-4 9 4-9 4-9-4z" />
      <path d="M3 12l9 4 9-4M3 17l9 4 9-4" />
    </svg>
  );
}

export interface BrandMarkProps {
  /** Custom glyph; defaults to the layered-decks mark. */
  children?: ReactNode;
  className?: string;
}

/** Rounded accent square holding the product glyph (wireframe 1a). */
export function BrandMark({ children, className }: BrandMarkProps) {
  const classes = ["ds-brand-mark", className]
    .filter((part) => typeof part === "string" && part !== "")
    .join(" ");
  return (
    <span aria-hidden="true" className={classes}>
      {children ?? <LayersGlyph />}
    </span>
  );
}
