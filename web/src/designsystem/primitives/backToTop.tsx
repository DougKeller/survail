import type { ReactNode } from "react";

import "./backToTop.css";

interface BackToTopButtonProps {
  /** Optional leading icon, rendered aria-hidden. */
  icon?: ReactNode;
  label?: string;
  onClick: () => void;
  /** Hidden (and removed from the tab order) until the page is scrolled. */
  visible: boolean;
}

/** Fixed bottom-right return-to-top pill. */
export function BackToTopButton({
  icon,
  label = "Back to top",
  onClick,
  visible,
}: BackToTopButtonProps): ReactNode {
  return (
    <button
      aria-hidden={!visible}
      aria-label={label}
      className={
        visible ? "ds-back-to-top ds-back-to-top-visible" : "ds-back-to-top"
      }
      onClick={onClick}
      tabIndex={visible ? 0 : -1}
      type="button"
    >
      {icon !== undefined && (
        <span aria-hidden="true" className="ds-back-to-top-icon">
          {icon}
        </span>
      )}
      <span>{label}</span>
    </button>
  );
}
