import type { ComponentProps, ReactNode, Ref } from "react";

import "./workspace.css";

function joinClasses(parts: (string | undefined)[]): string {
  return parts
    .filter((part) => typeof part === "string" && part !== "")
    .join(" ");
}

export interface WorkspaceProps extends ComponentProps<"main"> {
  /** Reserve trailing grid columns for a PaneResizer + Panel pair.
      The panel column reads var(--ds-panel-width), settable inline. */
  panelOpen?: boolean;
  /** Lock the workspace to the viewport so nested content owns scrolling. */
  viewportLocked?: boolean;
}

/** Full-width working surface: content column plus optional side panel. */
export function Workspace({
  className,
  panelOpen = false,
  viewportLocked = false,
  ...rest
}: WorkspaceProps) {
  return (
    <main
      className={joinClasses([
        "ds-workspace",
        panelOpen ? "ds-workspace-panel-open" : undefined,
        viewportLocked ? "ds-workspace-viewport-locked" : undefined,
        className,
      ])}
      {...rest}
    />
  );
}

export interface PaneResizerProps extends ComponentProps<"div"> {
  /** Accessible name for the separator. */
  label: string;
}

/** Draggable divider between the workspace content and its side panel.
    Pointer/keyboard behavior is supplied by the caller via props. */
export function PaneResizer({ className, label, ...rest }: PaneResizerProps) {
  return (
    <div
      aria-label={label}
      aria-orientation="vertical"
      className={joinClasses(["ds-pane-resizer", className])}
      role="separator"
      {...rest}
    />
  );
}

export interface PanelProps {
  children?: ReactNode;
  /** id of the element naming this panel. */
  labelledBy?: string;
}

/** Sticky full-height side panel (the advisor drawer surface). */
export function Panel({ children, labelledBy }: PanelProps) {
  return (
    <aside aria-labelledby={labelledBy} className="ds-panel">
      {children}
    </aside>
  );
}

export interface PanelScrollProps {
  children?: ReactNode;
  /** Announce streamed content politely. */
  live?: boolean;
  ref?: Ref<HTMLDivElement>;
}

/** The scrolling body region inside a Panel. */
export function PanelScroll({ children, live = false, ref }: PanelScrollProps) {
  return (
    <div
      aria-live={live ? "polite" : undefined}
      className="ds-panel-scroll"
      ref={ref}
    >
      {children}
    </div>
  );
}
