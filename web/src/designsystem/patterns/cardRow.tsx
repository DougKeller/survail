import type { HTMLAttributes, ReactNode } from "react";

import "./cardRow.css";

type CardRowTone = "accent" | "accent-2" | "default";

const TONE_CLASS: Record<CardRowTone, string> = {
  accent: "ds-card-row-accent",
  "accent-2": "ds-card-row-accent-2",
  default: "",
};

interface CardRowProps extends Omit<
  HTMLAttributes<HTMLElement>,
  "children" | "onClick"
> {
  /** Trailing slot: mana pips, set code, row actions. */
  children?: ReactNode;
  /** Bold the card name (autocomplete hit, dragged row). */
  emphasis?: boolean;
  /** Show the six-dot drag grip. */
  grip?: boolean;
  /** Render as a link. Takes precedence over `interactive`. */
  href?: string;
  /** Render as a button when no href is given. */
  interactive?: boolean;
  /** Square, compact treatment for dense data views. */
  dense?: boolean;
  /** Leading interactive control, such as a move handle. */
  leadingAction?: ReactNode;
  /** Leading slot: art thumb, status pip. */
  leading?: ReactNode;
  /** Card name; accepts rich nodes (e.g. inline card references). */
  name: ReactNode;
  onClick?: () => void;
  qty?: number;
  tone?: CardRowTone;
}

function GripIcon(): ReactNode {
  return (
    <span aria-hidden="true" className="ds-card-row-grip">
      <svg fill="currentColor" height="16" viewBox="0 0 24 24" width="14">
        <circle cx="9" cy="6" r="1.5" />
        <circle cx="9" cy="12" r="1.5" />
        <circle cx="9" cy="18" r="1.5" />
        <circle cx="15" cy="6" r="1.5" />
        <circle cx="15" cy="12" r="1.5" />
        <circle cx="15" cy="18" r="1.5" />
      </svg>
    </span>
  );
}

/** The pill card row (wireframes' .crow) — the editor's central pattern. */
export function CardRow({
  children,
  emphasis = false,
  dense = false,
  grip = false,
  href,
  interactive = false,
  leading,
  leadingAction,
  name,
  onClick,
  qty,
  tone = "default",
  ...rest
}: CardRowProps): ReactNode {
  const className = [
    "ds-card-row",
    TONE_CLASS[tone],
    dense ? "ds-card-row-dense" : "",
    href !== undefined || interactive ? "ds-card-row-interactive" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const content = (
    <>
      {leadingAction === undefined ? null : (
        <span className="ds-card-row-leading-action">{leadingAction}</span>
      )}
      {grip ? <GripIcon /> : null}
      {leading === undefined ? null : (
        <span className="ds-card-row-leading">{leading}</span>
      )}
      {qty === undefined ? null : (
        <span className="ds-card-row-qty">{qty}</span>
      )}
      <span
        className={
          emphasis
            ? "ds-card-row-name ds-card-row-emphasis"
            : "ds-card-row-name"
        }
      >
        {name}
      </span>
      {children}
    </>
  );
  if (href !== undefined) {
    return (
      <a className={className} href={href} onClick={onClick} {...rest}>
        {content}
      </a>
    );
  }
  if (interactive) {
    return (
      <button className={className} onClick={onClick} type="button" {...rest}>
        {content}
      </button>
    );
  }
  return (
    <div className={className} {...rest}>
      {content}
    </div>
  );
}
