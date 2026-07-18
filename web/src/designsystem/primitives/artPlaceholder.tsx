import type { ReactNode } from "react";

import "./artPlaceholder.css";

export interface ArtProps {
  /** Real artwork (e.g. cover images); children stretch to fill the block. */
  children?: ReactNode;
  className?: string;
  /** Small caption shown in the placeholder, e.g. "commander art". */
  label?: ReactNode;
  /** Rounds the block (right-rail preview uses radius-md). */
  rounded?: boolean;
  /** Preset heights: sm 96px, md 120px, lg 260px (see --art-height-*). */
  size?: "lg" | "md" | "sm";
  /** Apply the washed image treatment (default on, as in the wireframes). */
  washed?: boolean;
}

/** Washed art placeholder block (wireframe .art). */
export function Art({
  children,
  className,
  label,
  rounded = false,
  size = "md",
  washed = true,
}: ArtProps) {
  const classes = [
    "ds-art",
    `ds-art-${size}`,
    washed ? "ds-art-washed" : undefined,
    rounded ? "ds-art-rounded" : undefined,
    children !== undefined ? "ds-art-fill" : undefined,
    className,
  ]
    .filter((part) => typeof part === "string" && part !== "")
    .join(" ");
  return (
    <div className={classes}>
      {label !== undefined && <span className="ds-art-label">{label}</span>}
      {children}
    </div>
  );
}
