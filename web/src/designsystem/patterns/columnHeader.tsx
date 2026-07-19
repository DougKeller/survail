import type { ComponentProps, ReactNode } from "react";

import "./columnHeader.css";

type ColumnHeaderTone = "accent" | "default";
type ColumnHeaderLevel = 2 | 3 | 4 | 5 | 6;

interface ColumnHeaderProps extends Omit<
  ComponentProps<"div">,
  "children" | "title"
> {
  /** Trailing slot: column menu, drag handle. */
  children?: ReactNode;
  count?: number;
  /** Top-left control, normally a column drag handle. */
  leading?: ReactNode;
  /** Semantic heading level; visual size is fixed by the pattern. */
  level?: ColumnHeaderLevel;
  /** Accent tone highlights the active drop target (wireframe 1d). */
  tone?: ColumnHeaderTone;
  title: string;
}

/** Board column heading: title + count + trailing slot (.colhd). */
export function ColumnHeader({
  children,
  count,
  level = 5,
  leading,
  title,
  tone = "default",
  ...rest
}: ColumnHeaderProps): ReactNode {
  const className =
    tone === "accent"
      ? "ds-column-header ds-column-header-accent"
      : "ds-column-header";
  const TitleTag = `h${String(level)}` as "h2" | "h3" | "h4" | "h5" | "h6";
  return (
    <div {...rest} className={className}>
      {(leading !== undefined || children !== undefined) && (
        <div className="ds-column-header-controls">
          {leading}
          <span className="ds-column-header-spacer" />
          {children}
        </div>
      )}
      <TitleTag className="ds-column-header-title">{title}</TitleTag>
      {count === undefined ? null : (
        <span className="ds-column-header-count">{count}</span>
      )}
    </div>
  );
}
