import type { ReactNode } from "react";

import "./timeline.css";

type TimelineTone = "accent" | "default" | "neutral";

const DOT_CLASS: Record<TimelineTone, string> = {
  accent: "ds-timeline-item-dot-accent",
  default: "",
  neutral: "ds-timeline-item-dot-neutral",
};

interface TimelineItemProps {
  /** Trailing action, e.g. a Revert button. */
  action?: ReactNode;
  children?: ReactNode;
  /** Fade the whole entry (reverted revision, wireframe 1f). */
  dimmed?: boolean;
  /** default: accent-2 dot · accent: origin/import · neutral: reverted. */
  tone?: TimelineTone;
}

/** History entry: round dot, connecting line, content, trailing action. */
export function TimelineItem({
  action,
  children,
  dimmed = false,
  tone = "default",
}: TimelineItemProps): ReactNode {
  const className = dimmed
    ? "ds-timeline-item ds-timeline-item-dimmed"
    : "ds-timeline-item";
  const dotClassName = ["ds-timeline-item-dot", DOT_CLASS[tone]]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={className}>
      <div aria-hidden="true" className="ds-timeline-item-rail">
        <span className={dotClassName} />
        <span className="ds-timeline-item-line" />
      </div>
      <div className="ds-timeline-item-body">{children}</div>
      {action === undefined ? null : (
        <div className="ds-timeline-item-action">{action}</div>
      )}
    </div>
  );
}
