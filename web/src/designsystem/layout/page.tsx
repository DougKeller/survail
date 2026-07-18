import type { ReactNode } from "react";

import "./page.css";

type PageElement = "div" | "main" | "section";

interface PageProps {
  as?: PageElement;
  /** Reflects in-flight work on the landmark via aria-busy. */
  busy?: boolean;
  children?: ReactNode;
}

/** Main content container: clamped padding, max width, centered. */
export function Page({ as = "main", busy, children }: PageProps): ReactNode {
  const Tag = as;
  return (
    <Tag aria-busy={busy} className="ds-page">
      {children}
    </Tag>
  );
}

interface PageHeaderProps {
  /** Trailing controls (filters, primary actions), pushed to the far edge. */
  actions?: ReactNode;
  /** Leading content — typically a Heading plus meta Text, baseline-aligned. */
  children?: ReactNode;
}

/** Title row for a screen: heading + meta on the left, actions trailing. */
export function PageHeader({ actions, children }: PageHeaderProps): ReactNode {
  return (
    <header className="ds-page-header">
      <div className="ds-page-header-lead">{children}</div>
      {actions === undefined ? null : (
        <div className="ds-page-header-actions">{actions}</div>
      )}
    </header>
  );
}
