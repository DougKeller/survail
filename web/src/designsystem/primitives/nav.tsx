import type { ComponentPropsWithoutRef } from "react";

import "./nav.css";

function joinClasses(parts: (string | undefined)[]): string {
  return parts
    .filter((part) => typeof part === "string" && part !== "")
    .join(" ");
}

export interface NavBarProps extends ComponentPropsWithoutRef<"nav"> {
  /** Draw the divider along the bottom edge (wireframe top bars). */
  divided?: boolean;
}

/** Horizontal navigation bar (Organic .nav). */
export function NavBar({ className, divided = false, ...rest }: NavBarProps) {
  return (
    <nav
      className={joinClasses([
        "ds-nav",
        divided ? "ds-nav-divided" : undefined,
        className,
      ])}
      {...rest}
    />
  );
}

export type NavBrandProps = ComponentPropsWithoutRef<"span">;

/** Caprasimo wordmark slot (Organic .nav-brand). */
export function NavBrand({ className, ...rest }: NavBrandProps) {
  return (
    <span className={joinClasses(["ds-nav-brand", className])} {...rest} />
  );
}

export interface NavLinkProps extends ComponentPropsWithoutRef<"a"> {
  /** Marks the link as the current page (aria-current="page" accent). */
  current?: boolean;
}

/** Styled nav anchor with aria-current accenting. */
export function NavLink({
  children,
  className,
  current = false,
  ...rest
}: NavLinkProps) {
  return (
    <a
      aria-current={current ? "page" : undefined}
      className={joinClasses(["ds-nav-link", className])}
      {...rest}
    >
      {children}
    </a>
  );
}
