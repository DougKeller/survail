import type { ScryfallCard } from "../cards/contracts";

export type DeckFormat =
  | "commander"
  | "brawl"
  | "standard"
  | "modern"
  | "pioneer"
  | "legacy"
  | "vintage"
  | "pauper";

export type CardZone =
  | "mainboard"
  | "sideboard"
  | "commander"
  | "companion"
  | "considering";

export type CardFinish = "nonfoil" | "foil" | "etched";
export type PriceProvider = "tcgplayer" | "cardmarket" | "cardhoarder";

export interface CardSet {
  id: string;
  quantity: number;
  zone: CardZone;
  finish: CardFinish;
  printing_id: string;
  oracle_id: string;
  card_name: string;
  set_code: string;
  collector_number: string;
  note: string;
  tags: string[];
  tag_ids?: string[];
  tag_weights?: Record<string, number>;
  scryfall: ScryfallCard;
}

export interface DeckTag {
  id: string;
  name: string;
  position: number;
  target: number;
}

export interface Deck {
  id: string;
  title: string;
  format: DeckFormat;
  description: string;
  generated_description: GeneratedDeckDescriptionContent | string | null;
  goal: string;
  metadata: { kind: string; commander_oracle_ids?: string[] };
  cardsets: CardSet[];
  tags?: DeckTag[];
  is_sample: boolean;
  revision: number;
  updated_at: string;
}

export interface DeckUpdate {
  title?: string;
  description?: string;
  goal?: string;
}

export interface DeckOperationChangeInput {
  printing_id: string;
  quantity_delta: number;
  zone: CardZone;
  finish: CardFinish;
  tags?: string[];
  note?: string;
}

interface DeckOperationChange extends DeckOperationChangeInput {
  oracle_id: string;
  card_name: string;
  set_code: string;
  collector_number: string;
  quantity_before: number;
  quantity_after: number;
  tags_before: string[];
  tags_after: string[];
}

export interface DeckOperation {
  id: string;
  deck_id: string;
  actor_id: string;
  client_operation_id: string;
  reason: string | null;
  revision_before: number;
  revision_after: number;
  created_at: string;
  changes: DeckOperationChange[];
}

export interface GeneratedDeckDescription {
  deck_id: string;
  revision: number;
  description: GeneratedDeckDescriptionContent | string;
  cached: boolean;
}

export interface GeneratedDeckDescriptionContent {
  overview: string;
  early_game: string;
  midgame: string;
  lategame: string;
}

interface ValidationError {
  error_id: string;
  code: string;
  message: string;
  cardset_id: string | null;
}

export interface Validation {
  valid: boolean;
  card_count: number;
  errors: ValidationError[];
}

export interface DeckOperationResult {
  operation: DeckOperation;
  deck: Deck;
  validation: Validation;
}
