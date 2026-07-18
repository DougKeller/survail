import type { GroupBy } from "./constants";
import { titleize } from "./text";

export const COLOR_SWATCHES: Record<string, string> = {
  W: "#f4ead2",
  U: "#7bc5ff",
  B: "#4e485c",
  R: "#ff7d5e",
  G: "#5ec67a",
  C: "#c7d1dd",
  White: "#f4ead2",
  Blue: "#7bc5ff",
  Black: "#4e485c",
  Red: "#ff7d5e",
  Green: "#5ec67a",
  Colorless: "#c7d1dd",
};

export const TYPE_SWATCHES: Record<string, string> = {
  Creature: "#4da3ff",
  Land: "#6fc17b",
  Instant: "#ffd166",
  Sorcery: "#ff8a5b",
  Artifact: "#b8c0cc",
  Enchantment: "#d78bff",
  Planeswalker: "#ff6f91",
  Battle: "#7ee0d4",
  Other: "#8f95b2",
  Unknown: "#8f95b2",
};

const ROLE_SWATCHES: Record<string, string> = {
  land: "#6fc17b",
  mana_ramp: "#5ec67a",
  card_advantage: "#4da3ff",
  card_selection: "#7bc5ff",
  targeted_disruption: "#ff8a5b",
  mass_disruption: "#ff6f91",
  enabler: "#d78bff",
  payoff: "#7ee0d4",
  enhancer: "#b8c0cc",
  unscored: "#8f95b2",
};

function manaValueSwatch(label: string): string {
  const value = Number.parseFloat(label.replace("Mana Value ", ""));
  if (!Number.isFinite(value)) return "#8f95b2";
  const hue = 210 - Math.min(value, 10) * 14;
  return `hsl(${String(hue)} 68% 62%)`;
}

export function groupSwatch(groupBy: GroupBy, label: string): string {
  if (groupBy === "color") return COLOR_SWATCHES[label] ?? "#8ca1b3";
  if (groupBy === "type") return TYPE_SWATCHES[label] ?? "#8f95b2";
  if (groupBy === "role")
    return (
      ROLE_SWATCHES[label.toLocaleLowerCase().replaceAll(" ", "_")] ?? "#8f95b2"
    );
  return manaValueSwatch(label);
}

export function chartRoleSwatch(key: string, label: string): string {
  return (
    ROLE_SWATCHES[key] ??
    ROLE_SWATCHES[label.toLocaleLowerCase().replaceAll(" ", "_")] ??
    "#8f95b2"
  );
}

export function groupPlaceholderLabel(groupBy: GroupBy, label: string): string {
  return groupBy === "role" ? titleize(label) : label;
}
