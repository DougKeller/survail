import type { HTMLAttributes, ReactNode } from "react";

import "./stack.css";

type StackGap = 0 | 1 | 2 | 3 | 4 | 6 | 8;
type StackAlign = "center" | "end" | "start" | "stretch";
type StackElement = "div" | "form" | "li" | "section" | "ul";

const GAP_CLASS: Record<StackGap, string> = {
  0: "ds-stack-gap-0",
  1: "ds-stack-gap-1",
  2: "ds-stack-gap-2",
  3: "ds-stack-gap-3",
  4: "ds-stack-gap-4",
  6: "ds-stack-gap-6",
  8: "ds-stack-gap-8",
};

const ALIGN_CLASS: Record<StackAlign, string> = {
  center: "ds-stack-align-center",
  end: "ds-stack-align-end",
  start: "ds-stack-align-start",
  stretch: "ds-stack-align-stretch",
};

interface StackProps extends Omit<
  HTMLAttributes<HTMLElement>,
  "children" | "className"
> {
  align?: StackAlign;
  as?: StackElement;
  children?: ReactNode;
  gap?: StackGap;
  /** id of the heading naming this region (aria-labelledby). */
  labelledBy?: string;
}

/** Vertical flex column with a space-scale gap. */
export function Stack({
  align = "stretch",
  as = "div",
  children,
  gap = 3,
  labelledBy,
  ...rest
}: StackProps): ReactNode {
  const Tag = as;
  const className = ["ds-stack", GAP_CLASS[gap], ALIGN_CLASS[align]].join(" ");
  return (
    <Tag aria-labelledby={labelledBy} className={className} {...rest}>
      {children}
    </Tag>
  );
}
