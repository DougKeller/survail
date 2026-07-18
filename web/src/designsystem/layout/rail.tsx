import type { ReactNode } from "react";

import "./rail.css";

interface RailProps {
  /** Render as a named region instead of a complementary landmark — for
      showcases nested inside another landmark (aside must be top level). */
  as?: "aside" | "section";
  children?: ReactNode;
  /** Accessible name for the landmark. */
  label?: string;
}

/** Right side panel: fixed width, hairline divider, surface tint, sticky. */
export function Rail({
  as = "aside",
  children,
  label = "Details",
}: RailProps): ReactNode {
  const Tag = as;
  return (
    <Tag aria-label={label} className="ds-rail">
      {children}
    </Tag>
  );
}
