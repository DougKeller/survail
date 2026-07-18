import type { ComponentPropsWithoutRef } from "react";

import "./tooltip.css";

export type TooltipSurfaceProps = ComponentPropsWithoutRef<"span">;

/** Floating tooltip surface (card hover previews). Position it from the
    caller — pass fixed left/top coordinates via style. */
export function TooltipSurface({ className, ...rest }: TooltipSurfaceProps) {
  const classes = ["ds-tooltip-surface", className]
    .filter((part) => typeof part === "string" && part !== "")
    .join(" ");
  return <span className={classes} role="tooltip" {...rest} />;
}
