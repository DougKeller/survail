import type { ReactNode } from "react";

import "./tablist.css";

export interface TabListProps {
  children?: ReactNode;
  /** Accessible name for the tablist. */
  label: string;
}

/** Segmented in-surface tab strip (card-details Analysis/Info). */
export function TabList({ children, label }: TabListProps) {
  return (
    <div aria-label={label} className="ds-tablist" role="tablist">
      {children}
    </div>
  );
}

export interface TabProps {
  children?: ReactNode;
  onClick?: () => void;
  selected?: boolean;
}

/** A pill tab inside a TabList; state is announced via aria-selected. */
export function Tab({ children, onClick, selected = false }: TabProps) {
  return (
    <button
      aria-selected={selected}
      className={
        selected ? "ds-tablist-tab ds-tablist-tab-selected" : "ds-tablist-tab"
      }
      onClick={onClick}
      role="tab"
      type="button"
    >
      {children}
    </button>
  );
}
