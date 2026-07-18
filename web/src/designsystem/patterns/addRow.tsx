import type { ReactNode } from "react";

import "./addRow.css";

type AddRowVariant = "ghost" | "row";

interface AddRowProps {
  /** Label, e.g. "add to Ramp" or "New category". */
  children?: ReactNode;
  onClick?: () => void;
  /** row: dashed pill inside a column · ghost: accent "New category" column. */
  variant?: AddRowVariant;
}

/** Dashed "add" affordance with button semantics (wireframes' .addrow). */
export function AddRow({
  children,
  onClick,
  variant = "row",
}: AddRowProps): ReactNode {
  const className =
    variant === "ghost" ? "ds-add-row ds-add-row-ghost" : "ds-add-row";
  return (
    <button className={className} onClick={onClick} type="button">
      <svg
        aria-hidden="true"
        fill="none"
        height="13"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2.75"
        viewBox="0 0 24 24"
        width="13"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
      {children}
    </button>
  );
}
