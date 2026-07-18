import type { ComponentPropsWithoutRef } from "react";

import "./starToggle.css";

export interface StarToggleProps extends ComponentPropsWithoutRef<"button"> {
  /** Fill the star (item is starred). */
  active?: boolean;
  /** Accessible name — the control is icon-only. */
  label: string;
}

/** Icon-only star toggle for marking core/favorite rows. */
export function StarToggle({
  active = false,
  className,
  label,
  type = "button",
  ...rest
}: StarToggleProps) {
  const classes = [
    "ds-star-toggle",
    active ? "ds-star-toggle-active" : undefined,
    className,
  ]
    .filter((part) => typeof part === "string" && part !== "")
    .join(" ");
  return (
    <button aria-label={label} className={classes} type={type} {...rest}>
      <svg
        aria-hidden="true"
        fill={active ? "currentColor" : "none"}
        height="16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.75"
        viewBox="0 0 24 24"
        width="16"
      >
        <path d="m12 2.6 2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.44 6.2 20.5l1.1-6.47L2.6 9.45l6.5-.95Z" />
      </svg>
    </button>
  );
}
