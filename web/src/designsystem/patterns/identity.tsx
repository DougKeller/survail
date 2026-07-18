import type { ReactNode } from "react";

import type { ManaColor } from "../primitives/pip";
import { ManaPip } from "../primitives/pip";
import "./identity.css";

const COLOR_MAP: Record<string, ManaColor> = {
  B: "b",
  C: "c",
  G: "g",
  R: "r",
  U: "u",
  W: "w",
};

interface ColorIdentityRowProps {
  /** WUBRG (plus C) symbols, in display order. */
  colors: string[];
  /** Accessible name for the group. */
  label?: string;
}

/** Row of large mana pips showing a deck's color identity (rail, 1d). */
export function ColorIdentityRow({
  colors,
  label = "Color identity",
}: ColorIdentityRowProps): ReactNode {
  return (
    <div aria-label={label} className="ds-identity-row" role="img">
      {colors.map((symbol) => {
        const glyph = symbol.toUpperCase();
        return (
          <ManaPip
            aria-hidden="true"
            color={COLOR_MAP[glyph] ?? "generic"}
            key={glyph}
            size={22}
          >
            {glyph}
          </ManaPip>
        );
      })}
    </div>
  );
}
