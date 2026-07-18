import type { ReactNode } from "react";

import "./notice.css";

export interface NoticeProps {
  children?: ReactNode;
  /** "alert" for errors, "status" for polite updates. */
  role?: "alert" | "status";
  tone?: "error" | "info" | "success";
}

/** Rounded inline message block (errors, empty states). */
export function Notice({ children, role, tone = "info" }: NoticeProps) {
  return (
    <div className={`ds-notice ds-notice-${tone}`} role={role}>
      {children}
    </div>
  );
}
