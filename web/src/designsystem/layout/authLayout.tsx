/* Auth shell (wireframe 1a): a centered panel with a vertically centered
   body and an optional flush footer strip (deck imagery). */
import type { ReactNode } from "react";

import "./authLayout.css";

export interface AuthLayoutProps {
  children?: ReactNode;
  /** Flush bottom strip, e.g. a washed Art block. */
  footer?: ReactNode;
}

/** Full-viewport centered sign-in panel. */
export function AuthLayout({ children, footer }: AuthLayoutProps) {
  return (
    <main className="ds-auth-layout">
      <section className="ds-auth-panel">
        <div className="ds-auth-panel-body">{children}</div>
        {footer !== undefined && (
          <div className="ds-auth-panel-footer">{footer}</div>
        )}
      </section>
    </main>
  );
}
