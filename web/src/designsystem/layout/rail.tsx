import type { ReactNode } from "react";

import "./rail.css";

interface RailProps {
  children?: ReactNode;
  /** Accessible name for the complementary landmark. */
  label?: string;
}

/** Right side panel: fixed width, hairline divider, surface tint, sticky. */
export function Rail({ children, label = "Details" }: RailProps): ReactNode {
  return (
    <aside aria-label={label} className="ds-rail">
      {children}
    </aside>
  );
}
