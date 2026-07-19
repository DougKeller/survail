import type { ReactNode } from "react";

import "./appShell.css";

export function AppShell({
  children,
  viewportLocked = false,
}: {
  children: ReactNode;
  viewportLocked?: boolean;
}) {
  return (
    <div
      className={
        viewportLocked
          ? "ds-app-shell ds-app-shell-viewport-locked"
          : "ds-app-shell"
      }
    >
      {children}
    </div>
  );
}
