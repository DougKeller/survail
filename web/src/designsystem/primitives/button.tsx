import type { ComponentPropsWithoutRef, ReactNode } from "react";

import "./button.css";

export type ButtonVariant = "ghost" | "primary" | "secondary";

export interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  /** Left-align the label (menu items in a popover list). */
  alignStart?: boolean;
  /** Stretch to the container width (wireframe .btn-block). */
  block?: boolean;
  /** Optional leading icon, e.g. an inline Lucide-style SVG. */
  icon?: ReactNode;
  /** Neutral-ink ghost for chrome-level actions that must not compete
      for emphasis (e.g. Log out in the global nav). Ghost variant only. */
  muted?: boolean;
  variant?: ButtonVariant;
}

function buttonClass(
  variant: ButtonVariant,
  extra: (string | false | undefined)[],
): string {
  return ["ds-btn", `ds-btn-${variant}`, ...extra]
    .filter((part) => typeof part === "string" && part !== "")
    .join(" ");
}

/** Pill button with a Caprasimo label (Organic .btn). */
export function Button({
  alignStart = false,
  block = false,
  children,
  className,
  icon,
  muted = false,
  type = "button",
  variant = "primary",
  ...rest
}: ButtonProps) {
  return (
    <button
      className={buttonClass(variant, [
        alignStart && "ds-btn-align-start",
        block && "ds-btn-block",
        muted && "ds-btn-muted",
        className,
      ])}
      type={type}
      {...rest}
    >
      {icon !== undefined && (
        <span aria-hidden="true" className="ds-btn-leading">
          {icon}
        </span>
      )}
      {children}
    </button>
  );
}

export interface ButtonLinkProps extends ComponentPropsWithoutRef<"a"> {
  /** Stretch to the container width (wireframe .btn-block). */
  block?: boolean;
  /** Optional leading icon, e.g. an inline Lucide-style SVG. */
  icon?: ReactNode;
  variant?: ButtonVariant;
}

/** Anchor styled as a pill button (wireframe `a.btn`, e.g. OAuth links). */
export function ButtonLink({
  block = false,
  children,
  className,
  icon,
  variant = "primary",
  ...rest
}: ButtonLinkProps) {
  return (
    <a
      className={buttonClass(variant, [block && "ds-btn-block", className])}
      {...rest}
    >
      {icon !== undefined && (
        <span aria-hidden="true" className="ds-btn-leading">
          {icon}
        </span>
      )}
      {children}
    </a>
  );
}

export interface IconButtonProps extends ComponentPropsWithoutRef<"button"> {
  /** Accessible name — icon-only buttons have no visible label. */
  label: string;
  /** sm: 24px inline row action (quick-actions caret). */
  size?: "md" | "sm";
  variant?: ButtonVariant;
}

/** Square icon-only pill button (wireframe .btn-icon); children is the icon. */
export function IconButton({
  children,
  className,
  label,
  size = "md",
  type = "button",
  variant = "secondary",
  ...rest
}: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={buttonClass(variant, [
        "ds-btn-icon",
        size === "sm" && "ds-btn-icon-sm",
        className,
      ])}
      type={type}
      {...rest}
    >
      {children}
    </button>
  );
}
