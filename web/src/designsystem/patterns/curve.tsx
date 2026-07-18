import type { ReactNode } from "react";

import "./curve.css";

interface CurveBarsProps {
  /** Accessible description of the chart. */
  label?: string;
  /** Bucket labels; defaults to the value index ("0", "1", …). */
  labels?: string[];
  /** Raw counts per bucket; heights are normalized to the tallest. */
  values: number[];
}

/** Quantize a 0..1 ratio to one of eleven height steps (h0..h10). */
function heightClass(ratio: number): string {
  if (ratio <= 0) return "ds-curve-bar-h0";
  const step = Math.max(1, Math.round(ratio * 10));
  return `ds-curve-bar-h${String(step)}`;
}

/** Tallest bars read accent-500, fading to accent-200 (wireframe 1d). */
function toneClass(ratio: number): string {
  if (ratio >= 0.95) return "ds-curve-bar-t4";
  if (ratio >= 0.65) return "ds-curve-bar-t3";
  if (ratio >= 0.35) return "ds-curve-bar-t2";
  return "ds-curve-bar-t1";
}

/** Mana-curve bar chart in pure CSS flex bars. */
export function CurveBars({
  label = "Mana curve",
  labels,
  values,
}: CurveBarsProps): ReactNode {
  const max = Math.max(...values, 0);
  return (
    <div aria-label={label} className="ds-curve" role="img">
      {values.map((value, index) => {
        const ratio = max > 0 ? value / max : 0;
        const barClassName = [
          "ds-curve-bar",
          heightClass(ratio),
          toneClass(ratio),
        ].join(" ");
        const bucket = labels?.[index] ?? String(index);
        return (
          <div className="ds-curve-col" key={bucket}>
            <div className="ds-curve-bar-track">
              <div className={barClassName} />
            </div>
            <span className="ds-curve-label">{bucket}</span>
          </div>
        );
      })}
    </div>
  );
}
