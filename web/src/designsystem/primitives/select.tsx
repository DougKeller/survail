import type { ComponentProps, ReactNode } from "react";

import "./select.css";

interface SelectOption {
  label: ReactNode;
  value: string;
}

export interface SelectProps extends Omit<
  ComponentProps<"select">,
  "children"
> {
  options: SelectOption[];
}

/** Pill select control matching the Organic input family. */
export function Select({ className, options, ...rest }: SelectProps) {
  const classes = ["ds-select", className]
    .filter((part) => typeof part === "string" && part !== "")
    .join(" ");
  return (
    <select className={classes} {...rest}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
