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
  disabled?: boolean;
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
  disabled = false,
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
        disabled={disabled}
        label={label}
        onClick={onToggle}
        variant="ghost"
      >
        {icon ?? <EllipsisIcon />}
      </IconButton>
      {open && (
        <div
          className="ds-menu-popover"
          id={id}
          onKeyDown={(event) => {
            if (
              event.key !== "ArrowDown" &&
              event.key !== "ArrowUp" &&
              event.key !== "Home" &&
              event.key !== "End"
            )
              return;
            event.preventDefault();
            const items = [
              ...event.currentTarget.querySelectorAll<HTMLElement>(
                '[role="menuitem"]:not([disabled])',
              ),
            ];
            if (items.length === 0) return;
            const current = items.indexOf(
              document.activeElement as HTMLElement,
            );
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? items.length - 1
                  : (current +
                      (event.key === "ArrowDown" ? 1 : -1) +
                      items.length) %
                    items.length;
            items[next]?.focus();
          }}
          role="menu"
          tabIndex={-1}
        >
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
