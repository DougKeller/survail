import type { CSSProperties } from "react";

import "./progress.css";

/** Clamped 0..1 fill fraction; exported for direct unit testing. */
export function meterFraction(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(Math.max(value / max, 0), 1);
}

export interface MeterProps {
  className?: string;
  /** Accessible name for the progressbar. */
  label?: string;
  max?: number;
  size?: "md" | "sm";
  tone?: "accent" | "accent2";
  value: number;
}

/** Pill progress meter (the 6–8px track from wireframes 1b/1d). */
export function Meter({
  className,
  label,
  max = 100,
  size = "md",
  tone = "accent",
  value,
}: MeterProps) {
  const classes = [
    "ds-meter",
    tone === "accent2" ? "ds-meter-accent-2" : undefined,
    size === "sm" ? "ds-meter-sm" : undefined,
    className,
  ]
    .filter((part) => typeof part === "string" && part !== "")
    .join(" ");
  const fillStyle = {
    "--ds-meter-fraction": meterFraction(value, max),
  } as CSSProperties;
  return (
    <div
      aria-label={label}
      aria-valuemax={max}
      aria-valuemin={0}
      aria-valuenow={value}
      className={classes}
      role="progressbar"
    >
      <div className="ds-meter-fill" style={fillStyle} />
    </div>
  );
}
