import { createContext } from "react";

import type {
  CardZone,
  DeckFormat,
  PriceProvider,
} from "../../modules/decks/contracts";
import type { CardRole } from "../../modules/decks/evaluations/contracts";
import type { ImportPreferences } from "../../modules/imports/contracts";

export const DECK_FORMATS: readonly DeckFormat[] = [
  "commander",
  "brawl",
  "standard",
  "modern",
  "pioneer",
  "legacy",
  "vintage",
  "pauper",
];

const CONSTRUCTED_ZONES: readonly CardZone[] = [
  "mainboard",
  "sideboard",
  "companion",
  "considering",
];

const COMMANDER_ZONES: readonly CardZone[] = [
  "commander",
  "mainboard",
  "considering",
];

export const CARD_ROLE_ORDER: readonly CardRole[] = [
  "land",
  "mana_ramp",
  "card_advantage",
  "removal",
  "board_wipe",
  "enabler",
  "enhancer",
  "payoff",
];

export const DEFAULT_IMPORT_PREFERENCES: ImportPreferences = {
  preserveTags: false,
};

export const PriceProviderContext = createContext<PriceProvider>("tcgplayer");

export type DeckView = "stacks" | "grid" | "text";
export type EditorView = "cards" | "scores" | "info";
export type GroupBy = "type" | "color" | "mana-value" | "role";
export type SortBy =
  | "alphabetical"
  | "mana-value"
  | "price"
  | "score"
  | "starred";

export interface DeckDisplayPreferences {
  view: DeckView;
  groupBy: GroupBy;
  sortBy: SortBy;
}

export function zonesFor(format: DeckFormat): readonly CardZone[] {
  return format === "commander" || format === "brawl"
    ? COMMANDER_ZONES
    : CONSTRUCTED_ZONES;
}
