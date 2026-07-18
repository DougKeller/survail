import type { ReactNode } from "react";

import "./board.css";

interface BoardLayoutProps {
  children?: ReactNode;
}

/** Side-by-side region pairing a Board with a right Rail (wireframe 1d). */
export function BoardLayout({ children }: BoardLayoutProps): ReactNode {
  return <div className="ds-board-layout">{children}</div>;
}

interface BoardProps {
  children?: ReactNode;
}

/** Horizontally scrolling row of top-aligned editor columns (wireframe 1d). */
export function Board({ children }: BoardProps): ReactNode {
  return <div className="ds-board">{children}</div>;
}

type BoardColumnWidth = "default" | "ghost" | "narrow";

const WIDTH_CLASS: Record<BoardColumnWidth, string> = {
  default: "",
  ghost: "ds-board-column-ghost",
  narrow: "ds-board-column-narrow",
};

interface BoardColumnProps {
  children?: ReactNode;
  /** default 236px · narrow 214px (commander) · ghost 184px (new category). */
  width?: BoardColumnWidth;
}

/** A fixed-width category column inside a Board. */
export function BoardColumn({
  children,
  width = "default",
}: BoardColumnProps): ReactNode {
  const className = ["ds-board-column", WIDTH_CLASS[width]]
    .filter(Boolean)
    .join(" ");
  return <section className={className}>{children}</section>;
}
