import type { ReactNode } from "react";

import "./columnHeader.css";

type ColumnHeaderTone = "accent" | "default";

interface ColumnHeaderProps {
  /** Trailing slot: column menu, drag handle. */
  children?: ReactNode;
  count?: number;
  /** Accent tone highlights the active drop target (wireframe 1d). */
  tone?: ColumnHeaderTone;
  title: string;
}

/** Board column heading: title + count + trailing slot (.colhd). */
export function ColumnHeader({
  children,
  count,
  title,
  tone = "default",
}: ColumnHeaderProps): ReactNode {
  const className =
    tone === "accent"
      ? "ds-column-header ds-column-header-accent"
      : "ds-column-header";
  return (
    <div className={className}>
      <h5 className="ds-column-header-title">{title}</h5>
      {count === undefined ? null : (
        <span className="ds-column-header-count">{count}</span>
      )}
      {children === undefined ? null : (
        <>
          <span className="ds-column-header-spacer" />
          {children}
        </>
      )}
    </div>
  );
}
