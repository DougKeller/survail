import type { ReactNode } from "react";

import "./divided.css";

interface DividedProps {
  children?: ReactNode;
}

/** Stack of rows separated by hairline dividers (validation list, tables). */
export function Divided({ children }: DividedProps): ReactNode {
  return <div className="ds-divided">{children}</div>;
}

type SplitPaneRatio = "even" | "wide-end";
type SplitPaneTint = "end" | "start";

interface SplitPaneProps {
  /** Exactly two panes: leading and trailing. */
  children?: ReactNode;
  ratio?: SplitPaneRatio;
  /** Give one side the surface tint (wireframe 1c import pane). */
  tint?: SplitPaneTint;
}

/** Two-column split (start fresh / import), stacking on small screens. */
export function SplitPane({
  children,
  ratio = "even",
  tint,
}: SplitPaneProps): ReactNode {
  const className = [
    "ds-split-pane",
    ratio === "wide-end" ? "ds-split-pane-wide-end" : "",
    tint === "start" ? "ds-split-pane-tint-start" : "",
    tint === "end" ? "ds-split-pane-tint-end" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return <div className={className}>{children}</div>;
}
