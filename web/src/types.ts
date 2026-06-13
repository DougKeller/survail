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
type FramePreference = "any" | "1993" | "1997" | "2003" | "2015" | "future";
export type ImportPreferenceKind =
  | "cheapest"
  | "original_printing"
  | "non_universes_beyond"
  | "frame"
  | "foil"
  | "nonfoil";

interface CardPrices {
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

interface CardFace {
  name: string;
  image_uris: { normal: string | null } | null;
}

export interface ScryfallCard {
  id: string;
  oracle_id: string;
  name: string;
  mana_cost: string | null;
  type_line: string;
  oracle_text: string | null;
  set: string;
  set_name: string;
  collector_number: string;
  rarity: string;
  finishes: string[];
  image_uris: { normal: string | null } | null;
  card_faces: CardFace[];
  legalities: Record<string, string>;
  colors?: string[];
  color_identity?: string[];
  cmc?: number;
  prices?: CardPrices;
  released_at?: string | null;
  border_color?: string | null;
  frame?: string | null;
  frame_effects?: string[];
  universes_beyond?: boolean;
}
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
  tags: string[];
  scryfall: ScryfallCard;
}
export type CardRole =
  | "land"
  | "mana_ramp"
  | "card_advantage"
  | "removal"
  | "board_wipe"
  | "enabler"
  | "enhancer"
  | "payoff";
interface QualitativeAnswer {
  criterion_id: string;
  rating: "very_low" | "low" | "neutral" | "high" | "very_high";
  score: number;
}
interface CardRoleScore {
  role: CardRole;
  score: number;
  description: string;
  answers: QualitativeAnswer[];
}
export interface CardRoleEvaluation {
  oracle_id: string;
  deck_revision: number;
  evaluator_version: string;
  overall_score: number;
  overall_comment: string;
  roles: CardRoleScore[];
  cached: boolean;
}
export interface CardEvaluationProgress {
  completed: number;
  total: number;
  average_seconds_per_card: number | null;
  eta_seconds: number | null;
}
export interface Deck {
  id: string;
  title: string;
  format: DeckFormat;
  description: string;
  generated_description: string;
  goal: string;
  metadata: { kind: string; commander_oracle_ids?: string[] };
  cardsets: CardSet[];
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
export interface DeckOperationResult {
  operation: DeckOperation;
  deck: Deck;
  validation: Validation;
}
export interface GeneratedDeckDescription {
  deck_id: string;
  revision: number;
  description: string;
  cached: boolean;
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
export interface DeckGuidanceProposal {
  id: string;
  deck_id: string;
  expected_revision: number;
  reason: string;
  proposed_goal: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DeckConversation {
  id: string;
  deck_id: string;
  created_at: string;
  updated_at: string;
}
interface AgentCard {
  printing_id: string;
  oracle_id: string;
  name: string;
  mana_cost: string | null;
  type_line: string;
  image_uri: string | null;
  set: string;
  finishes: string[];
}
export type AgentUiEvent =
  | { type: "user_message"; run_id: string; payload: { message: string } }
  | {
      type: "run_started" | "status" | "model_started" | "heartbeat";
      run_id: string;
      payload: { message: string };
    }
  | {
      type: "tool_started" | "tool_completed";
      run_id: string;
      payload: { message: string; tool_name: string };
    }
  | { type: "assistant_text_delta"; run_id: string; payload: { delta: string } }
  | {
      type: "assistant_completed";
      run_id: string;
      payload: { message: string };
    }
  | {
      type: "card_results";
      run_id: string;
      payload: { query: string; cards: AgentCard[] };
    }
  | {
      type: "guidance_proposal";
      run_id: string;
      payload: {
        proposal_id: string;
        expected_revision: number;
        reason: string;
        proposed_goal: string | null;
      };
    }
  | {
      type: "operation_applied";
      run_id: string;
      payload: {
        proposal_id: string;
        operation_id: string;
        revision: number;
        validation: Validation;
      };
    }
  | {
      type: "validation_results" | "deck_summary" | "run_completed";
      run_id: string;
      payload: object;
    }
  | { type: "run_failed"; run_id: string; payload: { message: string } }
  | {
      type: "stream_closed";
      run_id: string;
      payload: { expected: boolean; message: string };
    };
