import type { HTMLAttributes, MouseEventHandler, ReactNode } from "react";

import "./chip.css";

export interface ChipProps extends Omit<
  HTMLAttributes<HTMLElement>,
  "children" | "className" | "onClick" | "title"
> {
  children?: ReactNode;
  className?: string;
  /** Trailing bold slot, e.g. a count (wireframe: Mainboard <b>99</b>). */
  count?: ReactNode;
  /** Optional leading icon, rendered aria-hidden. */
  icon?: ReactNode;
  /** When given, the chip renders as a real button. */
  onClick?: MouseEventHandler<HTMLButtonElement>;
  title?: string;
}

/** Surface pill with optional icon and trailing count (wireframe .chip). */
export function Chip({
  children,
  className,
  count,
  icon,
  onClick,
  title,
  ...rest
}: ChipProps) {
  const classes = ["ds-chip", className]
    .filter((part) => typeof part === "string" && part !== "")
    .join(" ");
  const content = (
    <>
      {icon !== undefined && (
        <span aria-hidden="true" className="ds-chip-icon">
          {icon}
        </span>
      )}
      {children}
      {count !== undefined && <b className="ds-chip-count">{count}</b>}
    </>
  );
  if (onClick !== undefined) {
    return (
      <button
        className={classes}
        onClick={onClick}
        title={title}
        type="button"
        {...rest}
      >
        {content}
      </button>
    );
  }
  return (
    <span className={classes} title={title} {...rest}>
      {content}
    </span>
  );
}
