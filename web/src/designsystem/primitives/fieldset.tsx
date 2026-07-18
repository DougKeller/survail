import type { ReactNode } from "react";

import "./fieldset.css";

export interface FieldsetProps {
  children?: ReactNode;
  /** Trailing bold slot on the legend, e.g. "3/5". */
  count?: ReactNode;
  legend: ReactNode;
}

/** Grouped controls with a kicker-style legend (inline filter groups). */
export function Fieldset({ children, count, legend }: FieldsetProps) {
  return (
    <fieldset className="ds-fieldset">
      <legend className="ds-fieldset-legend">
        <span>{legend}</span>
        {count !== undefined && <b className="ds-fieldset-count">{count}</b>}
      </legend>
      <div className="ds-fieldset-body">{children}</div>
    </fieldset>
  );
}
