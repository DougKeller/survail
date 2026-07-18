import type { ReactNode } from "react";

import "./cardGallery.css";

interface ImageGridProps {
  children?: ReactNode;
  /** md: deck grid tiles (145px min) · sm: dense thumbnails (90px min). */
  min?: "md" | "sm";
}

/** Responsive auto-fill grid of card-art tiles. */
export function ImageGrid({ children, min = "md" }: ImageGridProps): ReactNode {
  const className =
    min === "sm" ? "ds-image-grid ds-image-grid-sm" : "ds-image-grid";
  return <div className={className}>{children}</div>;
}

interface StackColumnsProps {
  children?: ReactNode;
}

/** Masonry column flow for grouped card stacks (the stacks deck view). */
export function StackColumns({ children }: StackColumnsProps): ReactNode {
  return <div className="ds-stack-columns">{children}</div>;
}

interface StackSectionProps {
  children?: ReactNode;
}

/** One unbreakable group (heading + stack) inside StackColumns. */
export function StackSection({ children }: StackSectionProps): ReactNode {
  return <section className="ds-stack-section">{children}</section>;
}

interface CardStackProps {
  children?: ReactNode;
}

/** Overlapping pile of card tiles — each child shows its title band and
    lifts clear of the pile on hover or focus. */
export function CardStack({ children }: CardStackProps): ReactNode {
  return <div className="ds-card-stack">{children}</div>;
}
