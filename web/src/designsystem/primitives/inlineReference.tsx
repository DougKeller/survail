import type { ComponentProps, ReactNode } from "react";

import "./inlineReference.css";

type InlineReferenceTriggerProps = Omit<ComponentProps<"button">, "className">;

/** Dotted-underline inline reference (card mentions in running text).
    Also emits the legacy `inline-card-reference-trigger` class, kept as a
    stable end-to-end test hook. */
export function InlineReferenceTrigger({
  children,
  type = "button",
  ...rest
}: InlineReferenceTriggerProps): ReactNode {
  return (
    <button
      className="ds-inline-reference-trigger inline-card-reference-trigger"
      type={type}
      {...rest}
    >
      {children}
    </button>
  );
}

interface InlineTextProps {
  children?: ReactNode;
}

/** Inline span that preserves the source text's line breaks. */
export function InlineText({ children }: InlineTextProps): ReactNode {
  return <span className="ds-inline-text">{children}</span>;
}
