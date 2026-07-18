import type { ReactNode } from "react";

import "./emptyTile.css";

interface GhostTileProps {
  /** Render as a link instead of a button. */
  href?: string;
  /** Custom icon; defaults to a plus glyph. */
  icon?: ReactNode;
  /** Caprasimo label, e.g. "New deck". */
  label: string;
  onClick?: () => void;
}

function PlusIcon(): ReactNode {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="26"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2.75"
      viewBox="0 0 24 24"
      width="26"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** Dashed "New deck" / "New category" tile (wireframe 1b). */
export function GhostTile({
  href,
  icon,
  label,
  onClick,
}: GhostTileProps): ReactNode {
  const content = (
    <>
      {icon ?? <PlusIcon />}
      <span className="ds-ghost-tile-label">{label}</span>
    </>
  );
  if (href !== undefined) {
    return (
      <a className="ds-ghost-tile" href={href} onClick={onClick}>
        {content}
      </a>
    );
  }
  return (
    <button className="ds-ghost-tile" onClick={onClick} type="button">
      {content}
    </button>
  );
}
