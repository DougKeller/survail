import type { ReactNode } from "react";

import { Kicker } from "../layout/typography";
import { Meter } from "../primitives/progress";
import "./statPanel.css";

type MeterPanelTone = "accent" | "accent2";

interface MeterPanelProps {
  /** Kicker label, e.g. "Deck completion". */
  label: string;
  max: number;
  /** accent2 (default): complete/green · accent: in-progress/orange. */
  tone?: MeterPanelTone;
  value: number;
  /** Formatted reading shown opposite the label, e.g. "99 / 99". */
  valueText?: string;
}

/** Labeled meter block: kicker + value reading + Meter (rail, 1d). */
export function MeterPanel({
  label,
  max,
  tone = "accent2",
  value,
  valueText,
}: MeterPanelProps): ReactNode {
  const className =
    tone === "accent"
      ? "ds-meter-panel ds-meter-panel-accent"
      : "ds-meter-panel";
  return (
    <div className={className}>
      <div className="ds-meter-panel-head">
        <Kicker>{label}</Kicker>
        <span className="ds-meter-panel-value">
          {valueText ?? `${String(value)} / ${String(max)}`}
        </span>
      </div>
      <Meter label={label} max={max} tone={tone} value={value} />
    </div>
  );
}
