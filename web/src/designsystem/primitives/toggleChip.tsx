import type { ComponentPropsWithoutRef } from "react";

import "./toggleChip.css";

export type ToggleChipTone = "negative" | "neutral" | "positive";

const TONE_CLASS: Record<ToggleChipTone, string> = {
  negative: "ds-toggle-chip-negative",
  neutral: "ds-toggle-chip-neutral",
  positive: "ds-toggle-chip-positive",
};

export interface ToggleChipProps extends Omit<
  ComponentPropsWithoutRef<"button">,
  "className" | "type"
> {
  /** Whether the option is currently selected (rendered as aria-pressed). */
  pressed: boolean;
  /** How the current selection reads in a diff: positive = an addition
      (sage), negative = a removal (terracotta), neutral = unchanged. */
  tone?: ToggleChipTone;
}

/** Toggleable pill for diff-style multi-selects (Organic tag family). */
export function ToggleChip({
  pressed,
  tone = "neutral",
  ...rest
}: ToggleChipProps) {
  const classes = [
    "ds-toggle-chip",
    TONE_CLASS[tone],
    pressed ? "ds-toggle-chip-on" : undefined,
  ]
    .filter((part) => typeof part === "string")
    .join(" ");
  return (
    <button
      aria-pressed={pressed}
      className={classes}
      type="button"
      {...rest}
    />
  );
}
