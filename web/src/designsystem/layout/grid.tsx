import type { ReactNode } from "react";

import "./grid.css";

type GridGap = 2 | 3 | 4 | 6;
type GridColumns = 1 | 2 | 3 | 4;

const GAP_CLASS: Record<GridGap, string> = {
  2: "ds-grid-gap-2",
  3: "ds-grid-gap-3",
  4: "ds-grid-gap-4",
  6: "ds-grid-gap-6",
};

const COLUMNS_CLASS: Record<GridColumns, string> = {
  1: "ds-grid-cols-1",
  2: "ds-grid-cols-2",
  3: "ds-grid-cols-3",
  4: "ds-grid-cols-4",
};

interface GridProps {
  children?: ReactNode;
  /** Explicit column count; omit for responsive auto-fill tiles. */
  columns?: GridColumns;
  gap?: GridGap;
}

/** Tile grid — auto-fills min-width columns (deck dashboard) by default. */
export function Grid({ children, columns, gap = 4 }: GridProps): ReactNode {
  const className = [
    "ds-grid",
    GAP_CLASS[gap],
    columns === undefined ? "" : COLUMNS_CLASS[columns],
  ]
    .filter(Boolean)
    .join(" ");
  return <div className={className}>{children}</div>;
}
