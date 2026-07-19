import type { ComponentProps, ReactNode } from "react";

import "./cardZoneWorkspace.css";

function classes(parts: (string | false)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function CardsViewShell({ children }: { children: ReactNode }) {
  return <div className="ds-cards-view">{children}</div>;
}

export function CardsViewBody({ children }: { children: ReactNode }) {
  return <div className="ds-cards-view-layout">{children}</div>;
}

export function CardZoneMatrixLayout({ children }: { children: ReactNode }) {
  return (
    <div
      aria-label="Cards workspace"
      className="ds-cards-zone-matrix"
      role="region"
    >
      {children}
    </div>
  );
}

export function CardZoneRow({
  active = false,
  children,
  collapsed = false,
  ...rest
}: ComponentProps<"section"> & { active?: boolean; collapsed?: boolean }) {
  return (
    <section
      className={classes([
        "ds-cards-zone-row",
        collapsed && "ds-cards-zone-row-collapsed",
        active && "ds-cards-zone-row-target",
      ])}
      {...rest}
    >
      {children}
    </section>
  );
}

export function CardZoneRowHeader({ children }: { children: ReactNode }) {
  return <header className="ds-cards-zone-row-header">{children}</header>;
}

export function CardZoneRowTitle({
  children,
  id,
}: {
  children: ReactNode;
  id: string;
}) {
  return (
    <h2 className="ds-cards-zone-row-title" id={id}>
      {children}
    </h2>
  );
}

export function CardZoneRowScroll({
  children,
  collapsed = false,
  zone,
  ...rest
}: ComponentProps<"div"> & { collapsed?: boolean; zone: string }) {
  return (
    <div
      aria-hidden={collapsed || undefined}
      className={classes([
        "ds-cards-zone-row-scroll",
        collapsed && "ds-cards-zone-row-scroll-collapsed",
      ])}
      data-zone-scroll={zone}
      inert={collapsed || undefined}
      tabIndex={collapsed ? -1 : 0}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardZoneColumns({
  children,
  size,
}: {
  children: ReactNode;
  size: "large" | "medium" | "small";
}) {
  return (
    <div className={`ds-cards-zone-columns ds-cards-zone-columns-${size}`}>
      {children}
    </div>
  );
}

export function CardZoneColumn({
  active = false,
  children,
  ...rest
}: ComponentProps<"section"> & { active?: boolean }) {
  return (
    <section
      className={classes([
        "ds-cards-zone-column",
        active && "ds-cards-zone-column-target",
      ])}
      {...rest}
    >
      {children}
    </section>
  );
}

export function CardZoneColumnContent({ children }: { children: ReactNode }) {
  return <div className="ds-cards-zone-column-content">{children}</div>;
}

export function CardZoneEmpty({ children }: { children: ReactNode }) {
  return <div className="ds-cards-zone-empty">{children}</div>;
}
