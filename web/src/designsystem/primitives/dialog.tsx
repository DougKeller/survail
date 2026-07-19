import { useId } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

import { useModalBehavior } from "../interaction";
import "./dialog.css";

export interface DialogProps {
  /** Footer action row, usually Buttons. */
  actions?: ReactNode;
  /** Marks the surface busy while content loads (aria-busy). */
  busy?: boolean;
  children?: ReactNode;
  className?: string;
  /** Accessible name for the corner close button; omit to hide it. */
  closeLabel?: string;
  /** Supporting line under the title, wired up as the accessible
      description (aria-describedby). */
  description?: ReactNode;
  id?: string;
  onClose: () => void;
  open: boolean;
  /** wide: media-heavy dialogs (card details, printings). */
  size?: "md" | "wide";
  title: ReactNode;
}

function CloseGlyph() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="15"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2.75"
      viewBox="0 0 24 24"
      width="15"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/** Modal dialog (Organic .dialog-backdrop/.dialog) with focus trap,
    Escape-to-close, and backdrop-click dismissal built in. */
export function Dialog({
  actions,
  busy = false,
  children,
  className,
  closeLabel,
  description,
  id,
  onClose,
  open,
  size = "md",
  title,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const surfaceRef = useModalBehavior<HTMLDivElement>(open, onClose, {
    closeOnOutsidePointerDown: true,
  });
  if (!open) return null;
  const classes = [
    "ds-dialog",
    size === "wide" ? "ds-dialog-wide" : undefined,
    className,
  ]
    .filter((part) => typeof part === "string" && part !== "")
    .join(" ");
  return createPortal(
    <div className="ds-dialog-backdrop">
      <div
        aria-busy={busy || undefined}
        aria-describedby={description === undefined ? undefined : descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className={classes}
        id={id}
        ref={surfaceRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="ds-dialog-head">
          <div className="ds-dialog-head-copy">
            <h2 className="ds-dialog-title" id={titleId}>
              {title}
            </h2>
            {description !== undefined && (
              <p className="ds-dialog-description" id={descriptionId}>
                {description}
              </p>
            )}
          </div>
          {closeLabel !== undefined && (
            <button
              aria-label={closeLabel}
              className="ds-dialog-close"
              onClick={onClose}
              type="button"
            >
              <CloseGlyph />
            </button>
          )}
        </div>
        <div className="ds-dialog-body">{children}</div>
        {actions !== undefined && (
          <div className="ds-dialog-actions">{actions}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
