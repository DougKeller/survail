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

export function chartRoleSwatch(key: string, label: string): string {
  return (
    ROLE_SWATCHES[key] ??
    ROLE_SWATCHES[label.toLocaleLowerCase().replaceAll(" ", "_")] ??
    "#8f95b2"
  );
}

export function tagSwatches(
  keys: readonly string[],
): ReadonlyMap<string, string> {
  const uniqueKeys = [...new Set(keys)].sort((left, right) =>
    left.localeCompare(right),
  );
  const colors = new Map<string, string>();
  uniqueKeys.forEach((key, index) => {
    if (key === "untagged") {
      colors.set(key, "#8f95b2");
      return;
    }
    const assignedBefore = uniqueKeys
      .slice(0, index)
      .filter((candidate) => candidate !== "untagged").length;
    const hue = (assignedBefore * 137.508 + 18) % 360;
    colors.set(key, `hsl(${hue.toFixed(3)} 68% 52%)`);
  });
  return colors;
}
