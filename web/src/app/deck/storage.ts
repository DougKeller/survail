import type { PriceProvider } from "../../modules/decks/contracts";
import type {
  ImportPreferenceRule,
  ImportPreferences,
} from "../../modules/imports/contracts";

import {
  DEFAULT_IMPORT_PREFERENCES,
  type DeckDisplayPreferences,
} from "./constants";

export function isPriceProvider(value: string): value is PriceProvider {
  return (
    value === "tcgplayer" || value === "cardmarket" || value === "cardhoarder"
  );
}

export function storedPriceProvider(): PriceProvider {
  const stored = localStorage.getItem("survail.price-provider");
  return stored !== null && isPriceProvider(stored) ? stored : "tcgplayer";
}

function isImportPreferenceRule(value: object): value is ImportPreferenceRule {
  if (!("kind" in value) || typeof value.kind !== "string") return false;
  if (value.kind === "cheapest") {
    return "bufferPercent" in value && typeof value.bufferPercent === "number";
  }
  if (value.kind === "frame") {
    return (
      "frame" in value &&
      ["1993", "1997", "2003", "2015", "future"].includes(String(value.frame))
    );
  }
  return [
    "original_printing",
    "non_universes_beyond",
    "foil",
    "nonfoil",
  ].includes(value.kind);
}

export function storedImportPreferences(): ImportPreferences {
  const stored = localStorage.getItem("survail.import-preferences");
  if (stored === null) return DEFAULT_IMPORT_PREFERENCES;
  try {
    const parsed = JSON.parse(stored) as {
      preserveTags?: boolean;
      rules?: object[];
    };
    if (
      typeof parsed.preserveTags !== "boolean" ||
      !Array.isArray(parsed.rules) ||
      parsed.rules.length !== 6 ||
      !parsed.rules.every(isImportPreferenceRule) ||
      new Set(parsed.rules.map((rule) => rule.kind)).size !== 6
    ) {
      return DEFAULT_IMPORT_PREFERENCES;
    }
    return { preserveTags: parsed.preserveTags, rules: parsed.rules };
  } catch {
    return DEFAULT_IMPORT_PREFERENCES;
  }
}

export function storedDeckDisplayPreferences(): DeckDisplayPreferences {
  const stored = localStorage.getItem("survail.deck-display-preferences");
  if (stored === null) {
    return { view: "stacks", groupBy: "mana-value", sortBy: "alphabetical" };
  }
  try {
    const parsed = JSON.parse(stored) as {
      view?: string;
      groupBy?: string;
      sortBy?: string;
    };
    const { view, groupBy, sortBy } = parsed;
    if (
      (view !== "stacks" && view !== "grid" && view !== "text") ||
      (groupBy !== "type" &&
        groupBy !== "color" &&
        groupBy !== "mana-value" &&
        groupBy !== "role") ||
      (sortBy !== "alphabetical" &&
        sortBy !== "mana-value" &&
        sortBy !== "price" &&
        sortBy !== "score")
    ) {
      return { view: "stacks", groupBy: "mana-value", sortBy: "alphabetical" };
    }
    return { view, groupBy, sortBy };
  } catch {
    return { view: "stacks", groupBy: "mana-value", sortBy: "alphabetical" };
  }
}
