import type { PriceProvider } from "../../modules/decks/contracts";
import type { ImportPreferences } from "../../modules/imports/contracts";

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

export function storedImportPreferences(): ImportPreferences {
  const stored = localStorage.getItem("survail.import-preferences");
  if (stored === null) return DEFAULT_IMPORT_PREFERENCES;
  try {
    const parsed = JSON.parse(stored) as { preserveTags?: boolean };
    if (typeof parsed.preserveTags !== "boolean") return DEFAULT_IMPORT_PREFERENCES;
    return { preserveTags: parsed.preserveTags };
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
        sortBy !== "score" &&
        sortBy !== "starred")
    ) {
      return { view: "stacks", groupBy: "mana-value", sortBy: "alphabetical" };
    }
    return { view, groupBy, sortBy };
  } catch {
    return { view: "stacks", groupBy: "mana-value", sortBy: "alphabetical" };
  }
}
