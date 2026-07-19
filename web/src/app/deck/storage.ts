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

export function storePriceProvider(provider: PriceProvider): void {
  localStorage.setItem("survail.price-provider", provider);
}

export function storedImportPreferences(): ImportPreferences {
  const stored = localStorage.getItem("survail.import-preferences");
  if (stored === null) return DEFAULT_IMPORT_PREFERENCES;
  try {
    const parsed = JSON.parse(stored) as { preserveTags?: boolean };
    if (typeof parsed.preserveTags !== "boolean")
      return DEFAULT_IMPORT_PREFERENCES;
    return { preserveTags: parsed.preserveTags };
  } catch {
    return DEFAULT_IMPORT_PREFERENCES;
  }
}

export function storeImportPreferences(preferences: ImportPreferences): void {
  localStorage.setItem(
    "survail.import-preferences",
    JSON.stringify(preferences),
  );
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
        groupBy !== "role" &&
        groupBy !== "tags") ||
      (sortBy !== "alphabetical" &&
        sortBy !== "mana-value" &&
        sortBy !== "price" &&
        sortBy !== "score")
    ) {
      return defaultDeckDisplayPreferences();
    }
    return { view, groupBy, sortBy };
  } catch {
    return defaultDeckDisplayPreferences();
  }
}

export function storeDeckDisplayPreferences(
  preferences: DeckDisplayPreferences,
): void {
  localStorage.setItem(
    "survail.deck-display-preferences",
    JSON.stringify(preferences),
  );
}

function defaultDeckDisplayPreferences(): DeckDisplayPreferences {
  return { view: "stacks", groupBy: "mana-value", sortBy: "alphabetical" };
}

export function storedAdvisorOpen(defaultValue = true): boolean {
  const stored = localStorage.getItem("survail.advisor-open");
  return stored === null ? defaultValue : stored === "true";
}

export function storeAdvisorOpen(open: boolean): void {
  localStorage.setItem("survail.advisor-open", String(open));
}

export function storedAdvisorWidth(): number {
  const stored = Number.parseInt(
    localStorage.getItem("survail.advisor-width") ?? "",
    10,
  );
  return Number.isFinite(stored) ? Math.max(320, stored) : 400;
}

export function storeAdvisorWidth(width: number): void {
  localStorage.setItem("survail.advisor-width", String(width));
}

export function storedDeckSummaryOpen(defaultOpen = true): boolean {
  const stored = localStorage.getItem("survail.deck-summary-open");
  return stored === null ? defaultOpen : stored === "true";
}

export function storeDeckSummaryOpen(open: boolean): void {
  localStorage.setItem("survail.deck-summary-open", String(open));
}

function isEditorView(value: string): value is EditorView {
  return (
    value === "cards" ||
    value === "scores" ||
    value === "charts" ||
    value === "info"
  );
}

function isDeckView(value: string): value is DeckView {
  return value === "stacks" || value === "grid" || value === "text";
}

function isGroupBy(value: string): value is GroupBy {
  return (
    value === "type" ||
    value === "color" ||
    value === "mana-value" ||
    value === "role" ||
    value === "tags"
  );
}

function isSortBy(value: string): value is SortBy {
  return (
    value === "alphabetical" ||
    value === "mana-value" ||
    value === "price" ||
    value === "score"
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
    groupBy:
      groupBy !== null && isGroupBy(groupBy) ? groupBy : fallback.groupBy,
    sortBy: sortBy !== null && isSortBy(sortBy) ? sortBy : fallback.sortBy,
  };
}
