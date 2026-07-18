import type { HTMLAttributes, ReactNode } from "react";

import "./inline.css";

type InlineGap = 1 | 2 | 3 | 4 | 6 | 8;
type InlineAlign = "baseline" | "center" | "end" | "start";
type InlineJustify = "between" | "center" | "end" | "start";
type InlineElement = "div" | "form" | "li" | "nav" | "span" | "ul";

const GAP_CLASS: Record<InlineGap, string> = {
  1: "ds-inline-gap-1",
  2: "ds-inline-gap-2",
  3: "ds-inline-gap-3",
  4: "ds-inline-gap-4",
  6: "ds-inline-gap-6",
  8: "ds-inline-gap-8",
};

const ALIGN_CLASS: Record<InlineAlign, string> = {
  baseline: "ds-inline-align-baseline",
  center: "ds-inline-align-center",
  end: "ds-inline-align-end",
  start: "ds-inline-align-start",
};

const JUSTIFY_CLASS: Record<InlineJustify, string> = {
  between: "ds-inline-justify-between",
  center: "ds-inline-justify-center",
  end: "ds-inline-justify-end",
  start: "ds-inline-justify-start",
};

interface InlineProps extends Omit<
  HTMLAttributes<HTMLElement>,
  "children" | "className"
> {
  align?: InlineAlign;
  as?: InlineElement;
  children?: ReactNode;
  gap?: InlineGap;
  justify?: InlineJustify;
  wrap?: boolean;
}

/** Horizontal flex row with a space-scale gap. */
export function Inline({
  align = "center",
  as = "div",
  children,
  gap = 2,
  justify = "start",
  wrap = false,
  ...rest
}: InlineProps): ReactNode {
  const Tag = as;
  const className = [
    "ds-inline",
    GAP_CLASS[gap],
    ALIGN_CLASS[align],
    JUSTIFY_CLASS[justify],
    wrap ? "ds-inline-wrap" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <Tag className={className} {...rest}>
      {children}
    </Tag>
  );
}

/** Flexible spacer: swallows the free space between inline siblings. */
export function FlexSpacer(): ReactNode {
  return <span aria-hidden="true" className="ds-spacer" />;
}
