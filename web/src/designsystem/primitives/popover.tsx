import type { CSSProperties, ReactNode, Ref } from "react";

import "./popover.css";

export interface PopoverAnchorProps {
  children?: ReactNode;
  /** Let the anchor flex-grow inside a toolbar row (fast-add bar, 1d). */
  grow?: boolean;
  ref?: Ref<HTMLDivElement>;
}

/** Positioning context for a Popover; attach dismissal refs here. */
export function PopoverAnchor({
  children,
  grow = false,
  ref,
}: PopoverAnchorProps) {
  const className = grow
    ? "ds-popover-anchor ds-popover-anchor-grow"
    : "ds-popover-anchor";
  return (
    <div className={className} ref={ref}>
      {children}
    </div>
  );
}

type PopoverAlign = "end" | "start" | "stretch";

const ALIGN_CLASS: Record<PopoverAlign, string> = {
  end: "ds-popover-end",
  start: "ds-popover-start",
  stretch: "ds-popover-stretch",
};

export interface PopoverProps {
  align?: PopoverAlign;
  children?: ReactNode;
  fixed?: boolean;
  /** Accessible name; when given the surface exposes role="dialog". */
  label?: string;
  ref?: Ref<HTMLDivElement>;
  style?: CSSProperties;
}

/** Anchored floating surface (autocomplete drawer, quick actions, menus). */
export function Popover({
  align = "start",
  children,
  fixed = false,
  label,
  ref,
  style,
}: PopoverProps) {
  return (
    <div
      aria-label={label}
      className={`ds-popover ${ALIGN_CLASS[align]}${fixed ? " ds-popover-fixed" : ""}`}
      ref={ref}
      role={label === undefined ? undefined : "dialog"}
      style={style}
    >
      {children}
    </div>
  );
}
