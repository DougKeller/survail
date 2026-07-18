import "./statusDot.css";

export interface StatusDotProps {
  className?: string;
  /** Disable the pulse for static status (reduced motion is handled
      globally by the base layer). */
  pulse?: boolean;
  tone?: "accent" | "accent2" | "neutral";
}

/** Pulsing saved-indicator dot (wireframe "saved · rev 42"). Decorative:
    pair it with visible text or an sr-only label. */
export function StatusDot({
  className,
  pulse = true,
  tone = "accent2",
}: StatusDotProps) {
  const classes = [
    "ds-status-dot",
    tone === "accent2" ? "ds-status-dot-accent-2" : `ds-status-dot-${tone}`,
    pulse ? undefined : "ds-status-dot-static",
    className,
  ]
    .filter((part) => typeof part === "string" && part !== "")
    .join(" ");
  return <span aria-hidden="true" className={classes} />;
}
