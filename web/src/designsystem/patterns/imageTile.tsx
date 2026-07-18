import type { HTMLAttributes, ReactNode } from "react";

import "./imageTile.css";

interface ImageTileProps {
  children?: ReactNode;
}

/** Card-art tile: positions corner badges and the hover action cluster
    over the artwork (stacks/grid deck views). */
export function ImageTile({ children }: ImageTileProps): ReactNode {
  return <div className="ds-image-tile">{children}</div>;
}

interface ImageTileActionsProps {
  children?: ReactNode;
}

/** Action cluster pinned to the tile's top edge; revealed on hover and
    whenever a control inside holds focus. */
export function ImageTileActions({
  children,
}: ImageTileActionsProps): ReactNode {
  return <div className="ds-image-tile-actions">{children}</div>;
}

type ImageTileBadgeCorner = "bottom-right" | "top-right";
type ImageTileBadgeTone = "accent" | "ink";

interface ImageTileBadgeProps extends Omit<
  HTMLAttributes<HTMLElement>,
  "children" | "className"
> {
  children?: ReactNode;
  corner?: ImageTileBadgeCorner;
  tone?: ImageTileBadgeTone;
}

/** Corner pill over the artwork (copy count, role score). */
export function ImageTileBadge({
  children,
  corner = "top-right",
  tone = "ink",
  ...rest
}: ImageTileBadgeProps): ReactNode {
  const className = [
    "ds-image-tile-badge",
    corner === "top-right"
      ? "ds-image-tile-badge-top"
      : "ds-image-tile-badge-bottom",
    tone === "ink" ? "ds-image-tile-badge-ink" : "ds-image-tile-badge-accent",
  ].join(" ");
  return (
    <span className={className} {...rest}>
      {children}
    </span>
  );
}

interface GroupTileProps extends Omit<
  HTMLAttributes<HTMLElement>,
  "children" | "className" | "title"
> {
  /** Bottom pill, e.g. "12 cards". */
  count?: ReactNode;
  /** Uppercase micro-heading, e.g. the group dimension ("Card type"). */
  eyebrow?: ReactNode;
  title: ReactNode;
}

/** Card-proportioned group header tile. Tint it per group by passing the
    --ds-group-accent custom property through style. */
export function GroupTile({
  count,
  eyebrow,
  title,
  ...rest
}: GroupTileProps): ReactNode {
  return (
    <article className="ds-group-tile" {...rest}>
      {eyebrow !== undefined && (
        <span className="ds-group-tile-eyebrow">{eyebrow}</span>
      )}
      <strong className="ds-group-tile-title">{title}</strong>
      {count !== undefined && (
        <span className="ds-group-tile-count">{count}</span>
      )}
    </article>
  );
}
