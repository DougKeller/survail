import type { ScryfallCard } from "../cards/contracts";
import type { CardFinish, CardZone, DeckFormat } from "../decks/contracts";

type FramePreference = "any" | "1993" | "1997" | "2003" | "2015" | "future";

export type ImportPreferenceKind =
  | "cheapest"
  | "original_printing"
  | "non_universes_beyond"
  | "frame"
  | "foil"
  | "nonfoil";

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

interface ImportedCardSet {
  quantity: number;
  printing_id: string;
  oracle_id: string;
  card_name: string;
  set_code: string;
  collector_number: string;
  finish: CardFinish;
  tags: string[];
  zone: CardZone;
  source_lines: number[];
  selected_price_usd: string | null;
  printing_selection_reason: string;
  scryfall: ScryfallCard;
}

interface ImportIssue {
  line_number: number;
  raw_line: string;
  code: string;
  message: string;
}

export interface MoxfieldImportPreview {
  cardsets: ImportedCardSet[];
  errors: ImportIssue[];
  used_ai_fallback: boolean;
}

export interface MoxfieldDeckImportResult {
  deck_id: string;
  operation_id: string;
  revision: number;
  preview: MoxfieldImportPreview;
}

export interface CreateMoxfieldDeckInput {
  title: string;
  format: DeckFormat;
  decklist: string;
  preferences: ImportPreferences;
}
