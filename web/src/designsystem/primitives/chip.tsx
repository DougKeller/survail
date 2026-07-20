import type {
  CSSProperties,
  HTMLAttributes,
  MouseEventHandler,
  ReactNode,
} from "react";

import "./chip.css";

export interface ChipProps extends Omit<
  HTMLAttributes<HTMLElement>,
  "children" | "className" | "onClick" | "title"
> {
  children?: ReactNode;
  /** Consumer-provided categorical color, surfaced as a quiet tinted chip. */
  accent?: string;
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
  accent,
  children,
  className,
  count,
  icon,
  onClick,
  style,
  title,
  ...rest
}: ChipProps) {
  const classes = ["ds-chip", accent === undefined ? undefined : "ds-chip-accent", className]
    .filter((part) => typeof part === "string" && part !== "")
    .join(" ");
  const chipStyle =
    accent === undefined
      ? style
      : ({ ...style, "--ds-chip-accent": accent } as CSSProperties);
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
        style={chipStyle}
        title={title}
        type="button"
        {...rest}
      >
        {content}
      </button>
    );
  }
  return (
    <span className={classes} style={chipStyle} title={title} {...rest}>
      {content}
    </span>
  );
}
