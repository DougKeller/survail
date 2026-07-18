/* Popover action menu — the deck-tile kebab ("Actions for X") pattern.
   State is owned by the caller: pass `open` plus an `onToggle` handler; close
   behavior (Escape, selection) stays in app code alongside its state. */
import type { ReactNode } from "react";

import { IconButton } from "./button";
import "./menu.css";

function EllipsisIcon() {
  return (
    <svg fill="currentColor" height="16" viewBox="0 0 24 24" width="16">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

export interface MenuProps {
  /** MenuItem children shown while open. */
  children?: ReactNode;
  className?: string;
  /** Trigger icon; defaults to a horizontal ellipsis. */
  icon?: ReactNode;
  /** Popover id, wired to the trigger via aria-controls. */
  id: string;
  /** Accessible trigger name, e.g. "Actions for Tessa's Toolbox". */
  label: string;
  onToggle: () => void;
  open: boolean;
}

/** Icon trigger plus a role=menu popover anchored to its corner. */
export function Menu({
  children,
  className,
  icon,
  id,
  label,
  onToggle,
  open,
}: MenuProps) {
  const classes = ["ds-menu", className]
    .filter((part) => typeof part === "string" && part !== "")
    .join(" ");
  return (
    <span className={classes}>
      <IconButton
        aria-controls={id}
        aria-expanded={open}
        aria-haspopup="menu"
        label={label}
        onClick={onToggle}
        variant="ghost"
      >
        {icon ?? <EllipsisIcon />}
      </IconButton>
      {open && (
        <div className="ds-menu-popover" id={id} role="menu">
          {children}
        </div>
      )}
    </span>
  );
}

export interface MenuItemProps {
  autoFocus?: boolean;
  children?: ReactNode;
  /** Destructive action treatment (e.g. "Delete deck"). */
  danger?: boolean;
  onSelect: () => void;
}

/** A single role=menuitem action row. */
export function MenuItem({
  autoFocus = false,
  children,
  danger = false,
  onSelect,
}: MenuItemProps) {
  return (
    <button
      autoFocus={autoFocus}
      className={danger ? "ds-menu-item ds-menu-item-danger" : "ds-menu-item"}
      onClick={onSelect}
      role="menuitem"
      type="button"
    >
      {children}
    </button>
  );
}
