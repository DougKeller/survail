/* Pip family: generic status pips, mana pips, and parsed mana costs.
   The mana-cost parsing (incl. hybrid handling) is ported from
   src/modules/cards/ui/manaCost.tsx, re-rendered on the Organic palette;
   this file replaces that component once migration lands. */
import type { ComponentPropsWithoutRef } from "react";

import "./pip.css";

export type PipSize = 16 | 22;
type PipTone = "accent" | "accent2" | "neutral";

const PIP_TONE_CLASS: Record<PipTone, string> = {
  accent: "ds-pip-accent",
  accent2: "ds-pip-accent-2",
  neutral: "ds-pip-neutral",
};

function pipClass(
  size: PipSize,
  toneClass: string,
  className: string | undefined,
): string {
  return ["ds-pip", toneClass, size === 22 ? "ds-pip-lg" : undefined, className]
    .filter((part) => typeof part === "string" && part !== "")
    .join(" ");
}

export interface PipProps extends ComponentPropsWithoutRef<"span"> {
  size?: PipSize;
  tone?: PipTone;
}

/** Small circular badge (wireframe .pip): counts, checks, warnings. */
export function Pip({
  className,
  size = 16,
  tone = "neutral",
  ...rest
}: PipProps) {
  return (
    <span
      className={pipClass(size, PIP_TONE_CLASS[tone], className)}
      {...rest}
    />
  );
}

export type ManaColor = "b" | "c" | "g" | "generic" | "r" | "u" | "w";

export interface ManaPipProps extends ComponentPropsWithoutRef<"span"> {
  color: ManaColor;
  size?: PipSize;
}

/** Mana-colored pip on the Organic mana palette (--mana-* tokens). */
export function ManaPip({
  className,
  color,
  size = 16,
  ...rest
}: ManaPipProps) {
  return (
    <span className={pipClass(size, `ds-mana-${color}`, className)} {...rest} />
  );
}

const COLOR_CLASSES: Record<string, string> = {
  W: "ds-mana-w",
  U: "ds-mana-u",
  B: "ds-mana-b",
  R: "ds-mana-r",
  G: "ds-mana-g",
  C: "ds-mana-c",
  S: "ds-mana-c",
};

const HYBRID_CLASSES: Record<string, string> = {
  "W/U": "ds-mana-hybrid-w-u",
  "U/B": "ds-mana-hybrid-u-b",
  "B/R": "ds-mana-hybrid-b-r",
  "R/G": "ds-mana-hybrid-r-g",
  "G/W": "ds-mana-hybrid-g-w",
  "W/B": "ds-mana-hybrid-w-b",
  "U/R": "ds-mana-hybrid-u-r",
  "B/G": "ds-mana-hybrid-b-g",
  "R/W": "ds-mana-hybrid-r-w",
  "G/U": "ds-mana-hybrid-g-u",
};

export interface ManaSymbol {
  text: string;
  className: string;
}

export function parseManaCost(cost: string): ManaSymbol[] {
  const symbols: ManaSymbol[] = [];
  for (const match of cost.matchAll(/\{([^}]+)\}/g)) {
    const raw = match[1];
    if (raw === undefined) continue;
    const base = raw.toUpperCase().replace(/\/P$/, "");
    const hybridClass = HYBRID_CLASSES[base];
    const colorClass = COLOR_CLASSES[base];
    if (hybridClass !== undefined) {
      symbols.push({ text: base.replace("/", ""), className: hybridClass });
    } else if (colorClass !== undefined) {
      symbols.push({ text: base, className: colorClass });
    } else {
      symbols.push({ text: base, className: "ds-mana-generic" });
    }
  }
  return symbols;
}

export interface ManaCostProps {
  className?: string;
  cost: string | null;
}

/** Parsed "{2}{R/W}" mana cost rendered as a row of mana pips. */
export function ManaCost({ className, cost }: ManaCostProps) {
  if (cost === null || cost.trim() === "") return null;
  const symbols = parseManaCost(cost);
  if (symbols.length === 0) return null;
  const classes = ["ds-mana-cost", className]
    .filter((part) => typeof part === "string" && part !== "")
    .join(" ");
  return (
    <span aria-label={`Mana cost ${cost}`} className={classes} role="img">
      {symbols.map((symbol, index) => (
        <span
          aria-hidden="true"
          className={`ds-pip ${symbol.className}`}
          key={`${String(index)}-${symbol.text}`}
        >
          {symbol.text}
        </span>
      ))}
    </span>
  );
}
