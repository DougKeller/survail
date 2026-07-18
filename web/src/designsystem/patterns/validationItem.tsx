import type { ReactNode } from "react";

import "./validationItem.css";

type ValidationStatus = "ok" | "warn";

interface ValidationItemProps {
  /** Trailing detail, e.g. "99 / 99" or "singleton ok". */
  detail?: ReactNode;
  label: ReactNode;
  /** Live-region semantics for standalone notices. */
  role?: "alert" | "status";
  status: ValidationStatus;
}

/** Validation check row: status pip + label + trailing detail (1e). */
export function ValidationItem({
  detail,
  label,
  role,
  status,
}: ValidationItemProps): ReactNode {
  return (
    <div
      className={`ds-validation-item ds-validation-item-${status}`}
      role={role}
    >
      <span aria-hidden="true" className="ds-validation-item-pip">
        {status === "ok" ? (
          <svg
            fill="none"
            height="10"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3.5"
            viewBox="0 0 24 24"
            width="10"
          >
            <path d="m5 12 4 4 10-11" />
          </svg>
        ) : (
          "!"
        )}
      </span>
      <span className="sr-only">
        {status === "ok" ? "Passed:" : "Warning:"}
      </span>
      <span className="ds-validation-item-label">{label}</span>
      {detail === undefined ? null : (
        <span className="ds-validation-item-detail">{detail}</span>
      )}
    </div>
  );
}
