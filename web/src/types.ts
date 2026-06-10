export type DeckFormat =
  | "commander" | "brawl" | "standard" | "modern"
  | "pioneer" | "legacy" | "vintage" | "pauper";
export type CardZone = "mainboard" | "sideboard" | "commander" | "companion" | "considering";
export type CardFinish = "nonfoil" | "foil" | "etched";
export type PriceProvider = "tcgplayer" | "cardmarket" | "cardhoarder";
export type FramePreference = "any" | "1993" | "1997" | "2003" | "2015" | "future";
export type ImportPreferenceKind =
  | "cheapest" | "original_printing" | "non_universes_beyond"
  | "frame" | "foil" | "nonfoil";

export interface CardPrices {
  usd: string | null;
  usd_foil: string | null;
  usd_etched: string | null;
  eur: string | null;
  eur_foil: string | null;
  tix: string | null;
}

export interface ImportPreferences {
  preserveTags: boolean;
  rules: ImportPreferenceRule[];
}

export type ImportPreferenceRule =
  | { kind: "cheapest"; bufferPercent: number }
  | { kind: "frame"; frame: Exclude<FramePreference, "any"> }
  | { kind: "original_printing" }
  | { kind: "non_universes_beyond" }
  | { kind: "foil" }
  | { kind: "nonfoil" };

export interface CardFace {
  name: string;
  image_uris: { normal: string | null } | null;
}

export interface ScryfallCard {
  id: string; oracle_id: string; name: string; mana_cost: string | null;
  type_line: string; oracle_text: string | null; set: string; set_name: string;
  collector_number: string; rarity: string; finishes: string[];
  image_uris: { normal: string | null } | null; card_faces: CardFace[];
  legalities: Record<string, string>;
  colors?: string[]; color_identity?: string[]; cmc?: number;
  prices?: CardPrices; released_at?: string | null; border_color?: string | null;
  frame?: string | null; frame_effects?: string[]; universes_beyond?: boolean;
}
export interface ImportedCardSet {
  quantity: number; printing_id: string; oracle_id: string; card_name: string;
  set_code: string; collector_number: string; finish: CardFinish; tags: string[];
  zone: CardZone; source_lines: number[]; selected_price_usd: string | null;
  printing_selection_reason: string;
  scryfall: ScryfallCard;
}
export interface ImportIssue {
  line_number: number; raw_line: string; code: string; message: string;
}
export interface MoxfieldImportPreview {
  cardsets: ImportedCardSet[]; errors: ImportIssue[];
}
export interface MoxfieldDeckImportResult {
  deck_id: string; operation_id: string; revision: number;
  preview: MoxfieldImportPreview;
}
export interface CardSet {
  id: string; quantity: number; zone: CardZone; finish: CardFinish;
  printing_id: string; oracle_id: string; card_name: string; set_code: string;
  collector_number: string; tags: string[]; scryfall: ScryfallCard;
}
export interface Deck {
  id: string; title: string; format: DeckFormat; description: string;
  metadata: { kind: string; commander_oracle_ids?: string[] };
  cardsets: CardSet[]; is_sample: boolean; revision: number; updated_at: string;
}
export interface DeckOperationChangeInput {
  printing_id: string; quantity_delta: number; zone: CardZone; finish: CardFinish;
  tags?: string[];
}
export interface DeckOperationChange extends DeckOperationChangeInput {
  oracle_id: string; card_name: string; set_code: string; collector_number: string;
  quantity_before: number; quantity_after: number; tags_before: string[]; tags_after: string[];
}
export interface DeckOperation {
  id: string; deck_id: string; actor_id: string; client_operation_id: string;
  reason: string | null; revision_before: number; revision_after: number;
  created_at: string; changes: DeckOperationChange[];
}
export interface DeckOperationResult {
  operation: DeckOperation; deck: Deck; validation: Validation;
}
export interface GeneratedDeckDescription {
  deck_id: string; revision: number; description: string; cached: boolean;
}
export interface ValidationError { error_id: string; code: string; message: string; cardset_id: string | null }
export interface Validation { valid: boolean; card_count: number; errors: ValidationError[] }
