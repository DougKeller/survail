import type { ReactNode, Ref, SyntheticEvent } from "react";

import "./disclosure.css";

export interface DisclosureProps {
  /** Panel content shown while open. */
  children?: ReactNode;
  /** Trailing bold slot on the summary, e.g. "3/5". */
  count?: ReactNode;
  /** Expand in the document flow instead of floating an overlay panel
      (activity feed hints). */
  inline?: boolean;
  label: ReactNode;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  /** Escape/outside-dismiss hooks attach to the details element. */
  ref?: Ref<HTMLDetailsElement>;
}

/** Pill summary + floating panel over native details/summary semantics
    (the score-filter menus). */
export function Disclosure({
  children,
  count,
  inline = false,
  label,
  onOpenChange,
  open,
  ref,
}: DisclosureProps) {
  function handleToggle(event: SyntheticEvent<HTMLDetailsElement>): void {
    onOpenChange?.(event.currentTarget.open);
  }
  return (
    <details
      className={
        inline ? "ds-disclosure ds-disclosure-inline" : "ds-disclosure"
      }
      onToggle={handleToggle}
      open={open}
      ref={ref}
    >
      <summary className="ds-disclosure-summary">
        <span className="ds-disclosure-label">{label}</span>
        {count !== undefined && <b className="ds-disclosure-count">{count}</b>}
      </summary>
      <div className="ds-disclosure-panel">{children}</div>
    </details>
  );
}
