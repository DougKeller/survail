import type { PriceProvider } from "../../modules/decks/contracts";
import type { ImportPreferences } from "../../modules/imports/contracts";

import {
  DEFAULT_IMPORT_PREFERENCES,
  type DeckDisplayPreferences,
  type DeckView,
  type EditorView,
  type GroupBy,
  type SortBy,
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
    return defaultDeckDisplayPreferences();
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
      return defaultDeckDisplayPreferences();
    }
    return { view, groupBy, sortBy };
  } catch {
    return defaultDeckDisplayPreferences();
  }
}

export function defaultDeckDisplayPreferences(): DeckDisplayPreferences {
  return { view: "stacks", groupBy: "mana-value", sortBy: "alphabetical" };
}

export function isEditorView(value: string): value is EditorView {
  return (
    value === "cards" ||
    value === "scores" ||
    value === "charts" ||
    value === "info"
  );
}

export function isDeckView(value: string): value is DeckView {
  return value === "stacks" || value === "grid" || value === "text";
}

export function isGroupBy(value: string): value is GroupBy {
  return (
    value === "type" ||
    value === "color" ||
    value === "mana-value" ||
    value === "role"
  );
}

export function isSortBy(value: string): value is SortBy {
  return (
    value === "alphabetical" ||
    value === "mana-value" ||
    value === "price" ||
    value === "score" ||
    value === "starred"
  );
}

export function editorViewFromSearchParams(
  searchParams: URLSearchParams,
): EditorView {
  const view = searchParams.get("tab");
  return view !== null && isEditorView(view) ? view : "cards";
}

export function deckDisplayPreferencesFromSearchParams(
  searchParams: URLSearchParams,
  fallback: DeckDisplayPreferences,
): DeckDisplayPreferences {
  const view = searchParams.get("view");
  const groupBy = searchParams.get("group");
  const sortBy = searchParams.get("sort");
  return {
    view: view !== null && isDeckView(view) ? view : fallback.view,
    groupBy: groupBy !== null && isGroupBy(groupBy) ? groupBy : fallback.groupBy,
    sortBy: sortBy !== null && isSortBy(sortBy) ? sortBy : fallback.sortBy,
  };
}
