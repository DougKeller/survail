import type { ReactNode } from "react";

import "./imageButton.css";

type ImageButtonSize = "full" | "preview" | "thumb";

interface ImageButtonProps {
  children?: ReactNode;
  /** Accessible name for the interactive variant. */
  label?: string;
  /** When omitted, renders a plain (non-interactive) frame. */
  onClick?: (() => void) | undefined;
  /** thumb: table-row art · preview: expanded-row art · full: fill parent. */
  size?: ImageButtonSize;
}

function frameClass(size: ImageButtonSize): string {
  return size === "full"
    ? "ds-image-button"
    : `ds-image-button ds-image-button-${size}`;
}

/** Borderless artwork button (card images that open a details view).
    Renders a static frame when no onClick is given. */
export function ImageButton({
  children,
  label,
  onClick,
  size = "full",
}: ImageButtonProps): ReactNode {
  if (onClick === undefined) {
    return <div className={frameClass(size)}>{children}</div>;
  }
  return (
    <button
      aria-label={label}
      className={frameClass(size)}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

interface ImageFallbackProps {
  children?: ReactNode;
}

/** Centered surface tile shown when a card has no artwork. */
export function ImageFallback({ children }: ImageFallbackProps): ReactNode {
  return <span className="ds-image-fallback">{children}</span>;
}
