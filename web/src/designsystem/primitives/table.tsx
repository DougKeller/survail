import type { ComponentPropsWithoutRef } from "react";

import "./table.css";

function joinClasses(parts: (string | undefined)[]): string {
  return parts
    .filter((part) => typeof part === "string" && part !== "")
    .join(" ");
}

export type TableProps = ComponentPropsWithoutRef<"table">;

/** Table shell with Organic header/divider styling (.ds-table). */
export function Table({ className, ...rest }: TableProps) {
  return <table className={joinClasses(["ds-table", className])} {...rest} />;
}

export type TableScrollProps = ComponentPropsWithoutRef<"div">;

/** Horizontal-scroll shell for wide tables (many role columns). */
export function TableScroll({ className, ...rest }: TableScrollProps) {
  return (
    <div className={joinClasses(["ds-table-scroll", className])} {...rest} />
  );
}

export interface SortableHeaderProps extends ComponentPropsWithoutRef<"button"> {
  /** Whether this column is the active sort. */
  active?: boolean;
  direction?: "asc" | "desc";
}

/** Sort-toggle button for table headers; inherits the th typography
    (font: inherit reset, like the legacy .score-sort-button). */
export function SortableHeader({
  active = false,
  children,
  className,
  direction = "asc",
  ...rest
}: SortableHeaderProps) {
  const classes = joinClasses([
    "ds-table-sort",
    active ? "ds-table-sort-active" : undefined,
    className,
  ]);
  return (
    <button className={classes} type="button" {...rest}>
      {children}
      {active && (
        <span aria-hidden="true" className="ds-table-sort-arrow">
          {direction === "desc" ? "▼" : "▲"}
        </span>
      )}
    </button>
  );
}
