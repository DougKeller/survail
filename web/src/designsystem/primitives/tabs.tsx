import type { ReactNode } from "react";

import "./tabs.css";

export interface TabNavProps {
  children?: ReactNode;
  /** Accessible name for the navigation landmark. */
  label: string;
}

/** Horizontal view-switcher navigation (editor Cards/Scores/Charts/Info). */
export function TabNav({ children, label }: TabNavProps) {
  return (
    <nav aria-label={label} className="ds-tabs">
      {children}
    </nav>
  );
}

export interface TabButtonProps {
  children?: ReactNode;
  /** Marks the active view with aria-current="page". */
  current?: boolean;
  onClick?: () => void;
}

/** A single pill tab; state is announced through aria-current. */
export function TabButton({
  children,
  current = false,
  onClick,
}: TabButtonProps) {
  return (
    <button
      aria-current={current ? "page" : undefined}
      className={current ? "ds-tab ds-tab-current" : "ds-tab"}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}
