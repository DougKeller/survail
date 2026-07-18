import type { ReactNode } from "react";

import "./typography.css";

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
type HeadingSize = "2xl" | "3xl" | "4xl" | "base" | "lg" | "md" | "xl";

const HEADING_SIZE_CLASS: Record<HeadingSize, string> = {
  "2xl": "ds-heading-2xl",
  "3xl": "ds-heading-3xl",
  "4xl": "ds-heading-4xl",
  base: "ds-heading-base",
  lg: "ds-heading-lg",
  md: "ds-heading-md",
  xl: "ds-heading-xl",
};

interface HeadingProps {
  children?: ReactNode;
  id?: string;
  level: HeadingLevel;
  /** Visual size override, independent of the semantic level. */
  size?: HeadingSize;
}

/** Semantic heading (Caprasimo) with optional visual size override. */
export function Heading({
  children,
  id,
  level,
  size,
}: HeadingProps): ReactNode {
  const Tag = `h${String(level)}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  const className = [
    "ds-heading",
    size === undefined ? "" : HEADING_SIZE_CLASS[size],
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <Tag className={className} id={id}>
      {children}
    </Tag>
  );
}

type TextSize = "2xs" | "base" | "body" | "md" | "sm" | "xs";
type TextElement = "div" | "p" | "span";

const TEXT_SIZE_CLASS: Record<TextSize, string> = {
  "2xs": "ds-text-2xs",
  base: "ds-text-base",
  body: "ds-text-body",
  md: "ds-text-md",
  sm: "ds-text-sm",
  xs: "ds-text-xs",
};

interface TextProps {
  as?: TextElement;
  children?: ReactNode;
  muted?: boolean;
  /** Preserve line breaks in the source text (oracle text blocks). */
  pre?: boolean;
  size?: TextSize;
}

/** Body copy in Figtree, sized off the type ramp. */
export function Text({
  as = "p",
  children,
  muted = false,
  pre = false,
  size = "body",
}: TextProps): ReactNode {
  const Tag = as;
  const className = [
    "ds-text",
    TEXT_SIZE_CLASS[size],
    muted ? "ds-text-muted" : "",
    pre ? "ds-text-pre" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return <Tag className={className}>{children}</Tag>;
}

type KickerTone = "accent" | "default";
type KickerElement = "p" | "span";

interface KickerProps {
  as?: KickerElement;
  children?: ReactNode;
  tone?: KickerTone;
}

/** Uppercase letter-spaced label (the wireframes' .k). */
export function Kicker({
  as = "p",
  children,
  tone = "default",
}: KickerProps): ReactNode {
  const Tag = as;
  const className = ["ds-kicker", tone === "accent" ? "ds-kicker-accent" : ""]
    .filter(Boolean)
    .join(" ");
  return <Tag className={className}>{children}</Tag>;
}

interface MarkProps {
  children?: ReactNode;
}

/** Inline match highlight (filter hits) on the accent wash. */
export function Mark({ children }: MarkProps): ReactNode {
  return <mark className="ds-mark">{children}</mark>;
}

interface CodeBlockProps {
  children?: ReactNode;
}

/** Preformatted monospace block on the surface tint (prompt/output dumps). */
export function CodeBlock({ children }: CodeBlockProps): ReactNode {
  return <pre className="ds-code-block">{children}</pre>;
}
