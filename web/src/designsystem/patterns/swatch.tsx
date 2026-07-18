import type { ReactNode } from "react";

import "./swatch.css";

type RampStep = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

/** Color tokens the swatch can render, named after --color-* in tokens.css. */
export type SwatchToken =
  | "accent"
  | "accent-2"
  | "bg"
  | "divider"
  | "surface"
  | "text"
  | `accent-2-${RampStep}`
  | `accent-${RampStep}`
  | `neutral-${RampStep}`;

export interface SwatchProps {
  /** Display label; defaults to the token's custom-property name. */
  label?: string;
  token: SwatchToken;
}

/** Labeled color chip for a tokens.css color (design-library page). */
export function Swatch({ label, token }: SwatchProps): ReactNode {
  return (
    <div className="ds-swatch">
      <span
        aria-hidden="true"
        className={`ds-swatch-chip ds-swatch-${token}`}
      />
      <span className="ds-swatch-name">{label ?? `--color-${token}`}</span>
    </div>
  );
}

/** Steps of the --space-* scale (Organic 1.10x density scale). */
export type SpaceStep = 1 | 2 | 3 | 4 | 6 | 8;

export interface SpaceSwatchProps {
  step: SpaceStep;
}

/** Labeled spacing bar sized by a --space-* token (design-library page). */
export function SpaceSwatch({ step }: SpaceSwatchProps): ReactNode {
  return (
    <div className="ds-swatch-space">
      <span
        aria-hidden="true"
        className={`ds-swatch-space-bar ds-swatch-space-${String(step)}`}
      />
      <span className="ds-swatch-name">{`--space-${String(step)}`}</span>
    </div>
  );
}
